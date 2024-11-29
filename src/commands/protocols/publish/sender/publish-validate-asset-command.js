import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import Command from '../../../command.js';
import {
    OPERATION_ID_STATUS,
    LOCAL_STORE_TYPES,
    PARANET_ACCESS_POLICY,
} from '../../../../constants/constants.js';

class PublishValidateAssetCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
        this.pendingStorageService = ctx.pendingStorageService;
    }

    async handleError(operationId, blockchain, errorMessage, errorType) {
        await this.operationService.markOperationAsFailed(
            operationId,
            blockchain,
            errorMessage,
            errorType,
        );
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            operationId,
            blockchain,
            storeType = LOCAL_STORE_TYPES.TRIPLE,
            paranetUAL,
            datasetRoot,
        } = command.data;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_START,
        );

        const { dataset: cachedData } = await this.operationIdService.getCachedOperationIdData(
            operationId,
        );
        const isValidAssertion = await this.validationService.validateDatasetRoot(
            cachedData,
            datasetRoot,
        );

        if (!isValidAssertion) {
            await this.handleError(
                operationId,
                blockchain,
                `Invalid dataset root for asset ???. Received value , received value from request: ${datasetRoot}`,
                this.errorType,
            );
            return Command.empty();
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
                        );
                        return Command.empty();
                    }
                } else {
                    await this.handleError(
                        operationId,
                        blockchain,
                        `Paranet ${paranetId} is not curated paranet.`,
                        this.errorType,
                    );
                    return Command.empty();
                }
            } catch (error) {
                await this.handleError(operationId, blockchain, error.message, this.errorType);
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

    /**
     * Builds default publishValidateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishValidateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishValidateAssetCommand;
