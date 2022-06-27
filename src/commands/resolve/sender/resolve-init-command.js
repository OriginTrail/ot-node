const ProtocolInitCommand = require('../../common/protocol-init-command');
const {
    ERROR_TYPE,
    NETWORK_PROTOCOLS,
    RESOLVE_REQUEST_STATUS,
} = require('../../../constants/constants');

class ResolveInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.resolveService = ctx.resolveService;

        this.commandName = 'resolveInitCommand';
        this.errorType = ERROR_TYPE.RESOLVE_INIT_ERROR;
        this.networkProtocol = NETWORK_PROTOCOLS.RESOLVE;
    }

    async prepareMessage(command) {
        const { assertionId } = command.data;

        return { assertionId };
    }

    async markResponseAsFailed(command, errorMessage) {
        await this.resolveService.processResolveResponse(
            command,
            RESOLVE_REQUEST_STATUS.FAILED,
            null,
            errorMessage,
        );
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
