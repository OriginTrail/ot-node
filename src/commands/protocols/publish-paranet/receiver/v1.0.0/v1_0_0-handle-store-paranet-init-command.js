import Command from '../../../../command.js';
import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';
import {
    ERROR_TYPE,
    OPERATION_ID_STATUS,
    NETWORK_MESSAGE_TYPES,
    PARANET,
} from '../../../../../constants/constants.js';

class HandleStoreParanetInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.publishService = ctx.publishParanetService;
        this.ualService = ctx.ualService;
        this.paranetService = ctx.paranetService;

        this.errorType = ERROR_TYPE.PUBLISH_PARANET.PUBLISH_PARANET_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const {
            operationId,
            publicAssertionId,
            privateAssertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            paranetUAL,
        } = commandData;
        const proximityScoreFunctionsPairId = commandData.proximityScoreFunctionsPairId ?? 1;

        const {
            blockchain: paranetBlockchain,
            contract: paranetContract,
            tokenId: paranetTokenId,
        } = this.ualService.resolveUAL(paranetUAL);
        const assetUAL = this.ualService.deriveUAL(blockchain, contract, tokenId);
        if (paranetBlockchain !== blockchain) {
            await this.handleError(
                operationId,
                blockchain,
                `Paranet blockchain ${paranetBlockchain} does not match asset blockchain ${blockchain} for asset with UAL ${assetUAL}`,
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
                    `Node with identity id ${identityId} is not a curated node in paranet with paranetid ${paranetId}. Asset UAL: ${assetUAL}`,
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
                `Knowledge asset with id ${knowledgeAssetId} is not in paranet with UAL ${paranetUAL}`,
                this.errorType,
                true,
            );
            return Command.empty();
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_START,
        );

        const validationResult = await this.validateReceivedData(
            operationId,
            publicAssertionId,
            privateAssertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
            proximityScoreFunctionsPairId,
        );

        this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_END,
        );

        return validationResult;
    }

    async validateReceivedData(
        operationId,
        publicAssertionId,
        privateAssertionId,
        blockchain,
        contract,
        tokenId,
        keyword,
        hashFunctionId,
    ) {
        const ual = this.ualService.deriveUAL(blockchain, contract, tokenId);

        this.logger.trace(`Validating assertion with ual: ${ual}`);
        await this.validateAssertionId(blockchain, contract, tokenId, publicAssertionId, ual);

        await this.operationIdService.cacheOperationIdData(operationId, {
            publicAssertionId,
            privateAssertionId,
            blockchain,
            contract,
            tokenId,
            keyword,
            hashFunctionId,
        });

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    async retryFinished(command) {
        const { operationId } = command.data;
        await this.handleError(
            `Retry count for command: ${command.name} reached! Unable to validate data for operation id: ${operationId}`,
            command,
        );
    }

    /**
     * Builds default handleStoreParanetInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleStoreParanetInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreParanetInitCommand;
