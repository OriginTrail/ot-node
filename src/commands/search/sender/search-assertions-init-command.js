const ProtocolInitCommand = require('../../common/protocol-init-command');
const {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
} = require('../../../constants/constants');

class SearchAssertionsInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);

        this.commandName = 'searchAssertionsInitCommand'
        this.errorType = ERROR_TYPE.SEARCH_ASSERTIONS_INIT_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.SEARCH_ASSERTIONS;
    }

    async prepareMessage(command) {
        const { query, options } = command.data;

        return { query, options };
    }

    /**
     * Builds default searchAssertionsInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'searchAssertionsInitCommand',
            delay: 0,
            period: 5000,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = SearchAssertionsInitCommand;
