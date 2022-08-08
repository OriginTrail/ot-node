const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const { ERROR_TYPE, NETWORK_MESSAGE_TYPES } = require('../../../../constants/constants');

class HandleSearchInitCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.searchService;

        this.errorType = ERROR_TYPE.SEARCH.HANDLE_SEARCH_INIT_ERROR;
    }

    async prepareMessage(commandData) {
        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: {} };
    }

    /**
     * Builds default handleSearchInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleSearchInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleSearchInitCommand;
