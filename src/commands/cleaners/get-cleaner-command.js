import CleanerCommand from './cleaner-command.js';
import {
    REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
    OPERATIONS,
    GET_CLEANUP_TIME_DELAY,
    GET_CLEANUP_TIME_MILLS,
    ARCHIVE_GET_FOLDER,
} from '../../constants/constants.js';

class GetCleanerCommand extends CleanerCommand {
    async findRowsForRemoval(nowTimestamp) {
        return this.repositoryModuleManager.findProcessedOperations(
            OPERATIONS.GET,
            nowTimestamp - GET_CLEANUP_TIME_DELAY,
            REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
        );
    }

    getArchiveFolderName() {
        return ARCHIVE_GET_FOLDER;
    }

    async deleteRows(ids) {
        return this.repositoryModuleManager.removeOperationRecords(OPERATIONS.GET, ids);
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'getCleanerCommand',
            data: {},
            period: GET_CLEANUP_TIME_MILLS,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

export default GetCleanerCommand;
