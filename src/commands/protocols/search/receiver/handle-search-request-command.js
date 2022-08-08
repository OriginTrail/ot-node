const HandleProtocolMessageCommand = require('../../common/handle-protocol-message-command');
const { ERROR_TYPE, NETWORK_MESSAGE_TYPES } = require('../../../../constants/constants');

class HandleSearchRequestCommand extends HandleProtocolMessageCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.searchService;

        this.errorType = ERROR_TYPE.SEARCH.HANDLE_SEARCH_REQUEST_ERROR;
    }

    async prepareMessage(commandData) {
        const { keyword, limit, offset } = commandData;

        const results = await this.operationService.localSearch(keyword, limit, offset);

        return { messageType: NETWORK_MESSAGE_TYPES.RESPONSES.ACK, messageData: { results } };
    }

    /**
     * Builds default handleSearchRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'handleSearchRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = HandleSearchRequestCommand;
