import Command from '../command.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    LOCAL_STORE_TYPES,
    ZERO_BYTES32,
    PARANET_ACCESS_POLICY,
} from '../../constants/constants.js';

class ValidateAssetCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.ualService = ctx.ualService;
        this.dataService = ctx.dataService;
        this.validationService = ctx.validationService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.VALIDATE_ASSET_ERROR;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            operationId,
            blockchain,
            contract,
            tokenId,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
            paranetUAL,
        } = command.data;

        this.logger.debug(
            `Validating Asset Command with operation id: ${operationId}, blockchain: ${blockchain}, contract: ${contract}, tokenId: ${tokenId}, store type: ${storeType}`,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_START,
        );

        let blockchainAssertionId;
        if (
            storeType === LOCAL_STORE_TYPES.TRIPLE ||
            storeType === LOCAL_STORE_TYPES.TRIPLE_PARANET
        ) {
            blockchainAssertionId = await this.blockchainModuleManager.getLatestAssertionId(
                blockchain,
                contract,
                tokenId,
            );
        } else {
            blockchainAssertionId = await this.blockchainModuleManager.getUnfinalizedAssertionId(
                blockchain,
                tokenId,
            );
        }
        if (!blockchainAssertionId || blockchainAssertionId === ZERO_BYTES32) {
            return Command.retry();
        }
        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        this.logger.info(
            `Validating asset's public assertion with id: ${cachedData.public.assertionId} ual: ${ual}`,
        );
        if (blockchainAssertionId !== cachedData.public.assertionId) {
            await this.handleError(
                operationId,
                blockchain,
                `Invalid assertion id for asset ${ual} and operation with id ${operationId}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${cachedData.public.assertionId}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.validationService.validateAssertion(
            cachedData.public.assertionId,
            blockchain,
            cachedData.public.assertion,
        );

        if (cachedData.private?.assertionId && cachedData.private?.assertion) {
            this.logger.info(
                `Validating asset's private assertion with id: ${cachedData.private.assertionId} ual: ${ual}`,
            );

            try {
                await this.validationService.validateAssertionId(
                    cachedData.private.assertion,
                    cachedData.private.assertionId,
                );
            } catch (error) {
                await this.handleError(
                    operationId,
                    blockchain,
                    error.message,
                    this.errorType,
                    true,
                );
                return Command.empty();
            }
        }

        let paranetId;
        if (storeType === LOCAL_STORE_TYPES.TRIPLE_PARANET) {
            try {
                const {
                    blockchain: paranetBlockchain,
                    contract: paranetContract,
                    tokenId: paranetTokenId,
                } = this.ualService.resolveUAL(paranetUAL);

                paranetId = this.paranetService.constructParanetId(
                    paranetBlockchain,
                    paranetContract,
                    paranetTokenId,
                );
                const paranetExists = await this.blockchainModuleManager.paranetExists(
                    paranetBlockchain,
                    paranetId,
                );
                if (!paranetExists) {
                    await this.handleError(
                        operationId,
                        blockchain,
                        `Paranet: ${paranetId} doesn't exist.`,
                        this.errorType,
                        true,
                    );
                    return Command.empty();
                }

                const nodesAccessPolicy = await this.blockchainModuleManager.getNodesAccessPolicy(
                    blockchain,
                    paranetId,
                );
                if (nodesAccessPolicy === PARANET_ACCESS_POLICY.CURATED) {
                    const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);
                    const isCuratedNode = await this.blockchainModuleManager.isCuratedNode(
                        blockchain,
                        paranetId,
                        identityId,
                    );
                    if (!isCuratedNode) {
                        await this.handleError(
                            operationId,
                            blockchain,
                            `Node is not part of curated paranet ${paranetId}  because node with id ${identityId} is not a curated node.`,
                            this.errorType,
                            true,
                        );
                        return Command.empty();
                    }
                } else {
                    await this.handleError(
                        operationId,
                        blockchain,
                        `Paranet ${paranetId} is not curated paranet.`,
                        this.errorType,
                        true,
                    );
                    return Command.empty();
                }
            } catch (error) {
                await this.handleError(
                    operationId,
                    blockchain,
                    error.message,
                    this.errorType,
                    true,
                );
                return Command.empty();
            }
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_END,
        );
        return this.continueSequence(
            { ...command.data, paranetId, retry: undefined, period: undefined },
            command.sequence,
        );
    }

    async retryFinished(command) {
        const { blockchain, contract, tokenId, operationId } = command.data;
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        await this.handleError(
            operationId,
            blockchain,
            `Max retry count for command: ${command.name} reached! Unable to validate ual: ${ual}`,
            this.errorType,
            true,
        );
    }

    /**
     * Builds default validateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'validateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default ValidateAssetCommand;
