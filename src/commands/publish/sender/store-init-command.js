const ProtocolInitCommand = require('../../common/protocol-init-command');
const {
    NETWORK_PROTOCOLS,
    ERROR_TYPE,
} = require('../../../constants/constants');

class StoreInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);

        this.commandName = 'storeInitCommand'
        this.errorType = ERROR_TYPE.STORE_INIT_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.STORE;
    }

    async prepareMessage(command) {
        const { assertionId } = command.data;

        return { assertionId };
    }

    /**
     * Builds default storeInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'storeInitCommand',
            delay: 0,
            period: 5000,
            retries: 3,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = StoreInitCommand;
