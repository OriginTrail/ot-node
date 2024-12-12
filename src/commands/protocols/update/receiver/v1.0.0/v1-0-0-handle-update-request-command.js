import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
    ERROR_TYPE,
} from '../../../../../constants/constants.js';

class HandleUpdateRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.updateService;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.pendingStorageService = ctx.pendingStorageService;
        this.operationIdService = ctx.operationIdService;
        this.pendingStorageService = ctx.pendingStorageService;
        this.signatureService = ctx.signatureService;

        this.errorType = ERROR_TYPE.UPDATE.UPDATE_LOCAL_STORE_REMOTE_ERROR;
        this.operationStartEvent = OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_START;
        this.operationEndEvent = OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_END;
        this.prepareMessageStartEvent =
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_PREPARE_MESSAGE_START;
        this.prepareMessageEndEvent =
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_PREPARE_MESSAGE_END;
        this.sendMessageResponseStartEvent =
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_SEND_RESPONSE_START;
        this.sendMessageResponseEndEvent =
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_SEND_RESPONSE_END;
        this.removeCachedSessionStartEvent =
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_REMOVE_CACHED_SESSION_START;
        this.removeCachedSessionEndEvent =
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_REMOVE_CACHED_SESSION_END;
    }

    async prepareMessage(commandData) {
        const { blockchain, operationId, datasetRoot } = commandData;

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_GET_CACHED_OPERATION_ID_DATA_START,
            operationId,
            blockchain,
        );
        const { dataset } = await this.operationIdService.getCachedOperationIdData(operationId);
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_GET_CACHED_OPERATION_ID_DATA_END,
            operationId,
            blockchain,
        );

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_VALIDATE_ASSET_REMOTE_START,
        );

        const validationResult = await this.validateReceivedData(
            operationId,
            datasetRoot,
            dataset,
            blockchain,
        );

        this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_VALIDATE_ASSET_REMOTE_END,
        );

        if (validationResult.messageType === NETWORK_MESSAGE_TYPES.RESPONSES.NACK) {
            return validationResult;
        }

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_CACHE_DATASET_START,
        );
        await this.pendingStorageService.cacheDataset(operationId, datasetRoot, dataset);
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            blockchain,
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_CACHE_DATASET_END,
        );

        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_SIGN_START,
            operationId,
            blockchain,
        );
        const identityId = await this.blockchainModuleManager.getIdentityId(blockchain);
        const { signer, v, r, s, vs } = await this.signatureService.signMessage(
            blockchain,
            datasetRoot,
        );
        this.operationIdService.emitChangeEvent(
            OPERATION_ID_STATUS.UPDATE.UPDATE_LOCAL_STORE_REMOTE_SIGN_END,
            operationId,
            blockchain,
        );

        return {
            messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK,
            messageData: { identityId, signer, v, r, s, vs },
        };
    }

    /**
     * Builds default handleUpdateRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'v1_0_0HandleUpdateRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default HandleUpdateRequestCommand;
