const ProtocolInitCommand = require('../../common/protocol-init-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class GetInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);
        this.operationService = ctx.getService;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    async prepareMessage(command) {
        const { ual, assertionId } = command.data;

        return { ual, assertionId };
    }

    /**
     * Builds default getInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getInitCommand',
            delay: 0,
            retries: 0,
            transactional: false,
            errorType: ERROR_TYPE.GET_INIT_ERROR,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = GetInitCommand;
