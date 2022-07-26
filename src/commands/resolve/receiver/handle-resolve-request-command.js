const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    HANDLER_ID_STATUS,
} = require('../../../constants/constants');
const HandleResolveCommand = require('./handle-resolve-command');

class HandleResolveRequestCommand extends HandleResolveCommand {
    constructor(ctx) {
        super(ctx);
        this.resolveService = ctx.resolveService;

        this.handlerIdStatusStart = HANDLER_ID_STATUS.RESOLVE.RESOLVE_REMOTE_START;
        this.handlerIdStatusEnd = HANDLER_ID_STATUS.RESOLVE.RESOLVE_REMOTE_END;
    }

    async prepareMessage(commandData) {
        const { ual, assertionId, handlerId } = commandData;
        await this.handlerIdService.updateHandlerIdStatus(handlerId, this.handlerIdStatusStart);

        // TODO: validate assertionId / ual

        const nquads = await this.resolveService.localResolve(ual, assertionId, handlerId);

        const messageType =
            nquads.metadata.length && nquads.data.length
                ? NETWORK_MESSAGE_TYPES.RESPONSES.ACK
                : NETWORK_MESSAGE_TYPES.RESPONSES.NACK;
        await this.handlerIdService.updateHandlerIdStatus(handlerId, this.handlerIdStatusEnd);

        return { messageType, messageData: { nquads } };
    }

    /**
     * Builds default handleResolveRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleResolveRequestCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_RESOLVE_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleResolveRequestCommand;
