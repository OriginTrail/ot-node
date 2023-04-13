import Command from '../command.js';
// eslint-disable-next-line no-unused-vars
import { COMMAND_STATUS, FINALIZED_COMMAND_CLEANUP_TIME_MILLS } from '../../constants/constants.js';

/**
 * Increases approval for Bidding contract on blockchain
 */
class CommandsCleanerCommand extends Command {
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
        // TODO: Uncomment after discussion
        // await this.repositoryModuleManager.removeFinalizedCommands([
        //     COMMAND_STATUS.COMPLETED,
        //     COMMAND_STATUS.FAILED,
        //     COMMAND_STATUS.EXPIRED,
        //     COMMAND_STATUS.UNKNOWN,
        // ]);
        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to clean finalized commands: error: ${error.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'commandsCleanerCommand',
            data: {},
            period: FINALIZED_COMMAND_CLEANUP_TIME_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default CommandsCleanerCommand;
