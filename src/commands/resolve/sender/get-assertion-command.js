const Command = require('../../command');
const { ERROR_TYPE } = require('../../../constants/constants');

class LocalResolveCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        let { id } = command.data;

        if (id.startsWith('dkg://')) {
            const { assertionId } = await this.blockchainModuleManager.getAssetProofs(
                id.split('/').pop(),
            );
            if (assertionId) {
                id = assertionId;
            }
        }

        const commandData = command.data;
        commandData.assertionId = id;

        return this.continueSequence(commandData, command.sequence);
    }

    handleError(handlerId, error, msg) {
        this.logger.error({
            msg,
            Operation_name: 'Error',
            Event_name: ERROR_TYPE.GET_ASSERTION_COMMAND,
            Event_value1: error.message,
            Id_operation: handlerId,
        });
    }

    /**
     * Builds default getAssertionCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getAssertionCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = LocalResolveCommand;
