import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
} from '../../../../../constants/constants.js';

class HandleStoreRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.validationService = ctx.validationService;
        this.operationService = ctx.publishService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.tripleStoreService = ctx.tripleStoreService;
        this.ualService = ctx.ualService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.operationIdService = ctx.operationIdService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.signatureService = ctx.signatureService;

        this.errorType = ERROR_TYPE.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_END;
        this.prepareMessageStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_PREPARE_MESSAGE_END;
        this.sendMessageResponseStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_SEND_RESPONSE_START;
        this.sendMessageResponseEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_SEND_RESPONSE_END;
        this.removeCachedSessionStartEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_REMOVE_CACHED_SESSION_START;
        this.removeCachedSessionEndEvent =
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_REMOVE_CACHED_SESSION_END;
    }

    async prepareMessage(commandData) {
        const { blockchain, operationId, assertionMerkleRoot, remotePeerId, isOperationV0 } =
            commandData;

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_REMOTE_START,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_GET_CACHED_OPERATION_ID_DATA_START,
            operationId,
            blockchain,
        );
        const { assertion } = await this.operationIdService.getCachedOperationIdData(operationId);
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_GET_CACHED_OPERATION_ID_DATA_END,
            operationId,
            blockchain,
        );

        const validationResult = await this.validateReceivedData(
            operationId,
            assertionMerkleRoot,
            assertion,
            blockchain,
            isOperationV0,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_REMOTE_END,
        );

        if (validationResult.messageType === NETWORK_MESSAGE_TYPES.RESPONSES.NACK) {
            return validationResult;
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_CACHE_ASSERTION_START,
        );
        await this.pendingStorageService.cacheAssertion(
            operationId,
            assertionMerkleRoot,
            assertion,
            remotePeerId,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_CACHE_ASSERTION_END,
        );

        const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_SIGN_START,
            operationId,
            blockchain,
        );

        const { v, r, s, vs } = await this.signatureService.signMessage(
            blockchain,
            assertionMerkleRoot,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_LOCAL_STORE_REMOTE_SIGN_END,
            operationId,
            blockchain,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.PUBLISH.PUBLISH_VALIDATE_ASSET_REMOTE_END,
        );

        return {
            messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
            messageData: { identityId, v, r, s, vs },
        };
    }

    /**
     * Builds default handleStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleStoreRequestCommand;
