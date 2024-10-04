import {
    PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_MILLS,
    REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
    PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_DELAY,
    ARCHIVE,
} from '../../constants/constants.js';
import CleanerCommand from './cleaner-command.js';

class BlockchainEventCleanerCommand extends CleanerCommand {
    async findRowsForRemoval(nowTimestamp) {
        return this.repositoryModuleManager.findProcessedEvents(
            nowTimestamp - PROCESSED_BLOCKCHAIN_EVENTS_CLEANUP_TIME_DELAY,
            REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
        );
    }

    getArchiveFolderName() {
        return ARCHIVE.BLOCKCHAIN_EVENTS_FOLDER;
    }

    async deleteRows(ids) {
        return this.repositoryModuleManager.removeEvents(ids);
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
