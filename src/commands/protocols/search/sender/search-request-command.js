const ProtocolRequestCommand = require('../../common/protocol-request-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class SearchRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.searchService;

        this.errorType = ERROR_TYPE.SEARCH.SEARCH_REQUEST_ERROR;
    }

    async prepareMessage(command) {
        const { keyword, limit, offset } = command.data;

        return { keyword, limit, offset };
    }

    /**
     * Builds default searchRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'searchRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SearchRequestCommand;
