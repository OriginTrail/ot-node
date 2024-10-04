import Command from '../../../command.js';
import ValidateAssetCommand from '../../../common/validate-asset-command.js';
import {
    // ERROR_TYPE,
    OPERATION_ID_STATUS,
    LOCAL_STORE_TYPES,
    EVM_ZERO,
    PARANET,
} from '../../../../constants/constants.js';

class PublishParanetValidateAssetCommand extends ValidateAssetCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishParanetService;
        this.paranetService = ctx.paranetService;
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
        } = command.data;

        const cachedData = await this.operationIdService.getCachedOperationIdData(operationId);
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);
        const {
            blockchain: paranetBlockchain,
            contract: paranetContract,
            tokenId: paranetTokenId,
        } = this.ualService.resolveUAL(cachedData.paranetUAL);

        if (paranetBlockchain !== blockchain) {
            await this.handleError(
                operationId,
                blockchain,
                `Paranet blockchain ${paranetBlockchain} does not match asset blockchain ${blockchain} for asset with UAL ${ual}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        // Validate node is in paranet
        const paranetId = this.paranetService.constructParanetId(
            paranetBlockchain,
            paranetContract,
            paranetTokenId,
        );
        const nodesAccessPolicy = await this.blockchainModuleManager.getNodesAccessPolicy(
            blockchain,
            paranetId,
        );
        if (nodesAccessPolicy === PARANET.ACCESS_POLICY.CURATED) {
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
                    `Node with identity id ${identityId} is not a curated node in paranet with paranetid ${paranetId}. Asset UAL: ${ual}`,
                    this.errorType,
                    true,
                );
                return Command.empty();
            }
        }

        // Validate asset is in paranet
        const knowledgeAssetId = await this.paranetService.constructKnowledgeAssetId(
            blockchain,
            contract,
            tokenId,
        );
        const knowledgeAssetParanetId = await this.blockchainModuleManager.getParanetId(
            blockchain,
            knowledgeAssetId,
        );
        if (knowledgeAssetParanetId !== paranetId) {
            await this.handleError(
                operationId,
                blockchain,
                `Knowledge asset with id ${knowledgeAssetId} is not in paranet with UAL ${cachedData.paranetUAL}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_START,
        );

        let blockchainAssertionId;
        if (storeType === LOCAL_STORE_TYPES.TRIPLE) {
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
        if (!blockchainAssertionId || blockchainAssertionId === EVM_ZERO.BYTES32) {
            return Command.retry();
        }
        this.logger.info(
            `Validating asset's public assertion with id: ${cachedData.cachedAssertions.public.assertionId} ual: ${ual}`,
        );

        if (blockchainAssertionId !== cachedData.cachedAssertions.public.assertionId) {
            await this.handleError(
                operationId,
                blockchain,
                `Invalid assertion id for asset ${ual}. Received value from blockchain: ${blockchainAssertionId}, received value from request: ${cachedData.cachedAssertions.assertionId}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.validationService.validateAssertion(
            cachedData.cachedAssertions.public.assertionId,
            blockchain,
            cachedData.cachedAssertions.public.assertion,
        );

        if (
            cachedData.cachedAssertions.private?.assertionId &&
            cachedData.cachedAssertions.private?.assertion
        ) {
            this.logger.info(
                `Validating asset's private assertion with id: ${cachedData.cachedAssertions.private.assertionId} ual: ${ual}`,
            );

            try {
                this.validationService.validateAssertionId(
                    cachedData.cachedAssertions.private.assertion,
                    cachedData.cachedAssertions.private.assertionId,
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

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_END,
        );
        return this.continueSequence(
            { ...command.data, retry: undefined, period: undefined },
            command.sequence,
        );
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
     * Builds default PublishParanetValidateAssetCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishParanetValidateAssetCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default PublishParanetValidateAssetCommand;
