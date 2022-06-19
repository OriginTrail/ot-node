const ProtocolRequestCommand = require('../../common/protocol-request-command');
const {
    NETWORK_PROTOCOLS,
    ERROR_TYPE
} = require('../../../constants/constants');

class StoreRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;

        this.commandName = 'storeRequestCommand'
        this.errorType = ERROR_TYPE.STORE_REQUEST_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.STORE;
    }

    async prepareMessage(command) {

    }

    /**
     * Builds default storeRequestCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'storeRequestCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = StoreRequestCommand;
