const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    OPERATION_ID_STATUS,
} = require('../../../../constants/constants');

class HandleGetRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;

        this.errorType = ERROR_TYPE.GET.GET_REQUEST_REMOTE_ERROR;
    }

    async prepareMessage(commandData) {
        const { ual, assertionId, operationId } = commandData;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_REMOTE_START,
        );

        // TODO: validate assertionId / ual

        const nquads = await this.operationService.localGet(ual, assertionId, operationId);

        const messageType =
            nquads.metadata.length && nquads.data.length
                ? NETWORK_MESSAGE_TYPES.RESPONSES.ACK
                : NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
        await this.operationIdService.updateOperationIdStatus(
            operationId,
            OPERATION_ID_STATUS.GET.GET_REMOTE_END,
        );

        return { messageType, messageData: { nquads } };
    }

    /**
     * Builds default handleGetRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleGetRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_GET_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleGetRequestCommand;
