const NetworkProtocolCommand = require('../../common/network-protocol-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class NetworkSearchCommand extends NetworkProtocolCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.searchService;

        this.errorType = ERROR_TYPE.SEARCH.NETWORK_SEARCH_ERROR;
    }

    getKeywords(command) {
        return command.data.keywords;
    }

    /**
     * Builds default networkSearchCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'networkSearchCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = NetworkSearchCommand;
