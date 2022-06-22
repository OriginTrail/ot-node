const ProtocolInitCommand = require('../../common/protocol-init-command');
const {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
} = require('../../../constants/constants');

class ResolveInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);

        this.commandName = 'resolveInitCommand'
        this.errorType = ERROR_TYPE.RESOLVE_INIT_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.RESOLVE;
    }

    async prepareMessage(command) {
        const { assertionId } = command.data;

        return { assertionId };
    }

    /**
     * Builds default resolveInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'resolveInitCommand',
            delay: 0,
            retries: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveInitCommand;
