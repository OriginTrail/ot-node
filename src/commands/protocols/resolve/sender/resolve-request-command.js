const ProtocolRequestCommand = require('../../common/protocol-request-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class ResolveRequestCommand extends ProtocolRequestCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.resolveService;
    }

    async prepareMessage(command) {
        const { ual, assertionId } = command.data;

        return { ual, assertionId };
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
            errorType: ERROR_TYPE.RESOLVE_REQUEST_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveRequestCommand;
