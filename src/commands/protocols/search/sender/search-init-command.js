const ProtocolInitCommand = require('../../common/protocol-init-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class SearchInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.searchService;

        this.errorType = ERROR_TYPE.SEARCH.SEARCH_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { keyword, limit, offset } = command.data;
        return { keyword, limit, offset };
    }

    /**
     * Builds default searchInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'searchInitCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SearchInitCommand;
