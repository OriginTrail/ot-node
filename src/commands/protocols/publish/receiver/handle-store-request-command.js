const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const { NETWORK_MESSAGE_TYPES } = require('../../../../constants/constants');

class HandleStoreRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.publishService;
    }

    async prepareMessage(commandData) {
        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleStoreRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleStoreRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleStoreRequestCommand;
