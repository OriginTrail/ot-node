import Command from '../command.js';
import {
    OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS,
    OPERATION_ID_STATUS,
} from '../../constants/constants.js';

/**
 * Increases approval for Bidding contract on blockchain
 */
class OperationIdCleanerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.fileService = ctx.fileService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute() {
        this.logger.debug('Starting command for removal of expired cache files');
        const timeToBeDeleted = Date.now() - OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS;
        await this.repositoryModuleManager.removeOperationIdRecord(timeToBeDeleted, [
            OPERATION_ID_STATUS.COMPLETED,
            OPERATION_ID_STATUS.FAILED,
        ]);
        let removed = await this.operationIdService.removeExpiredOperationIdMemoryCache(
            OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS,
        );
        if (removed) {
            this.logger.debug(
                `Successfully removed ${removed} expired cached operation entries from memory`,
            );
        }
        removed = await this.operationIdService.removeExpiredOperationIdFileCache(
            OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS,
        );
        if (removed) {
            this.logger.debug(`Successfully removed ${removed} expired cached operation files`);
        }

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
            period: OPERATION_ID_COMMAND_CLEANUP_TIME_MILLS,
            data: {},
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default OperationIdCleanerCommand;
