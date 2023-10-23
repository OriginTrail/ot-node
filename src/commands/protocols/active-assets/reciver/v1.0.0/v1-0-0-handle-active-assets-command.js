import HandleProtocolMessageCommand from '../../../common/handle-protocol-message-command.js';

import {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} from '../../../../../constants/constants.js';

class HandleActiveAssetsCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.activeAssetsService;
        this.errorType = ERROR_TYPE.ACTIVE_ASSETS.ACTIVE_ASSETS_REQUEST_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { operationId } = commandData;

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

        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.ACTIVE_ASSETS.ACTIVE_ASSETS_REQUEST_REMOTE_END,
        );

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData };
        // { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.NACK,
        // messageData: { errorMessage: `Invalid ` }
    }
}

export default HandleActiveAssetsCommand;
