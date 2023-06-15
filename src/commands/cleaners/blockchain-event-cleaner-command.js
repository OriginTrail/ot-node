import Command from '../command.js';
import {
    PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_MILLS,
    REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
    PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_DELAY,
    ARCHIVE_BLOCKCHAIN_EVENTS_FOLDER,
} from '../../constants/constants.js';

/**
 * Increases approval for Bidding contract on blockchain
 */
class BlockchainEventCleanerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.archiveService = ctx.archiveService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute() {
        const nowTimestamp = Date.now();

        let processedEventsForRemoval = await this.repositoryModuleManager.findProcessedEvents(
            nowTimestamp - PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_DELAY,
            REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
        );
        while (processedEventsForRemoval?.length >= REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER) {
            const archiveName = `${processedEventsForRemoval[0].startedAt}-${
                processedEventsForRemoval[processedEventsForRemoval.length - 1].startedAt
            }.json`;

            // eslint-disable-next-line no-await-in-loop
            await this.archiveService.archiveData(
                ARCHIVE_BLOCKCHAIN_EVENTS_FOLDER,
                archiveName,
                processedEventsForRemoval,
            );

            // remove from database;
            const ids = processedEventsForRemoval.map((command) => command.id);
            // eslint-disable-next-line no-await-in-loop
            await this.repositoryModuleManager.removeEvents(ids);

            // eslint-disable-next-line no-await-in-loop
            processedEventsForRemoval = await this.repositoryModuleManager.findProcessedEvents(
                nowTimestamp - PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_DELAY,
                REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
            );
        }

        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to clean processed events: error: ${error.message}`);
        return Command.repeat();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'blockchainEventCleanerCommand',
            data: {},
            period: PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default BlockchainEventCleanerCommand;
