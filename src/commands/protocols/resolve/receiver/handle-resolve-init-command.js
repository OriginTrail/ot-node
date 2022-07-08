const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const {
    ERROR_TYPE,
    NETWORK_MESSAGE_TYPES,
    HANDLER_ID_STATUS,
} = require('../../../../constants/constants');

class HandleResolveInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.tripleStoreModuleManager = ctx.tripleStoreModuleManager;
        this.operationService = ctx.resolveService;
    }

    async prepareMessage(commandData) {
        const { ual, assertionId, handlerId } = commandData;
        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.ASSERTION_EXISTS_LOCAL_START,
        );

        const assertionExists = await this.tripleStoreModuleManager.assertionExists(
            `${ual}/${assertionId}`,
        );
        const messageType = assertionExists
            ? NETWORK_MESSAGE_TYPES.RESPONSES.ACK
            : NETWORK_MESSAGE_TYPES.RESPONSES.NACK;

        await this.handlerIdService.updateHandlerIdStatus(
            handlerId,
            HANDLER_ID_STATUS.RESOLVE.ASSERTION_EXISTS_LOCAL_END,
        );

        return { messageType, messageData: {} };
    }

    /**
     * Builds default handleResolveInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleResolveInitCommand',
            delay: 0,
            transactional: false,
            errorType: ERROR_TYPE.HANDLE_RESOLVE_INIT_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleResolveInitCommand;
