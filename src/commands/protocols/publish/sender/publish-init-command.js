const ProtocolInitCommand = require('../../common/protocol-init-command');
const { ERROR_TYPE } = require('../../../../constants/constants');

class PublishInitCommand extends ProtocolInitCommand {
    constructor(ctx) {
        super(ctx);

        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.operationService = ctx.publishService;

        this.errorType = ERROR_TYPE.STORE_INIT_ERROR;
    }

    async prepareMessage(command) {
        const { assertionId, ual } = command.data;

        return { assertionId, ual };
    }

    /**
     * Builds default publishInitCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'publishInitCommand',
            delay: 0,
            period: 5000,
            retries: 3,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = PublishInitCommand;
