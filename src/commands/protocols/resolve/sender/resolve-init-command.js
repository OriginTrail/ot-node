const ProtocolInitCommand = require('../../common/protocol-init-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class ResolveInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.resolveService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async prepareMessage(command) {
        const { ual, assertionId } = command.data;

        return { ual, assertionId };
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
            errorType: ERROR_TYPE.RESOLVE_INIT_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ResolveInitCommand;
