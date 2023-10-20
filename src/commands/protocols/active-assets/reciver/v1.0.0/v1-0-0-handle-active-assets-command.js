import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command';

import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class HandleActiveAssetsCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.tripleStoreService = ctx.tripleStoreService;
        this.pendingStorageService = ctx.pendingStorageService;

        // TODO: add const
        this.errorType = ERROR_TYPE.ACTIVE_ASSETS.ACTIVE_ASSETS_REQUEST_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId } = commandData;
        // TODO: right const instead OPERATION_ID_STATUS.VALIDATE_ASSET_REMOTE_START
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.ACTIVE_ASSETS.ACTIVE_ASSETS_REQUEST_REMOTE_START,
        );
        const messageData = {};
        // preprare response, fetch data
        // const messageData =
        // [{
        // ual, keyword, hashFunctionId
        // }]

        // TODO: right const instead OPERATION_ID_STATUS.GET.GET_REMOTE_END,
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.ACTIVE_ASSETS.ACTIVE_ASSETS_REQUEST_REMOTE_END,
        );

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData };
    }
}

export default HandleActiveAssetsCommand;
