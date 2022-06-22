const ProtocolRequestCommand = require('../../common/protocol-request-command');
const {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
} = require('../../../constants/constants');

class ResolveRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);

        this.commandName = 'resolveRequestCommand'
        this.errorType = ERROR_TYPE.RESOLVE_REQUEST_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.RESOLVE;
    }

    async prepareMessage(command) {
        const { assertionId } = command.data;

        return { assertionId };
    }

    /**
     * Builds default resolveRequest
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveRequestCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveRequestCommand;
