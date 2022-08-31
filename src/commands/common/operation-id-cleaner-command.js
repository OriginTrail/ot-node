const Command = require('../command');
const constants = require('../../constants/constants');

/**
 * Increases approval for Bidding contract on blockchain
 */
class OperationIdCleanerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute() {
        const timeToBeDeleted = Date.now() - constants.OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS;
        await this.repositoryModuleManager.removeOperationIdRecord(timeToBeDeleted, [
            constants.OPERATION_ID_STATUS.COMPLETED,
            constants.OPERATION_ID_STATUS.FAILED,
        ]);
        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to clean operation ids table: error: ${error.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'operationIdCleanerCommand',
            period: constants.OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS,
            data: {},
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OperationIdCleanerCommand;
