import {
    FINALIZED_COMMAND_CLEANUP_TIME_MILLS,
    ARCHIVE_COMMANDS_FOLDER,
    REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
} from '../../constants/constants.js';
import CleanerCommand from './cleaner-command.js';

class CommandsCleanerCommand extends CleanerCommand {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.archiveService = ctx.archiveService;
    }

    async findRowsForRemoval(nowTimestamp) {
        return this.repositoryModuleManager.findFinalizedCommands(
            nowTimestamp,
            REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER,
        );
    }

    getArchiveFolderName() {
        return ARCHIVE_COMMANDS_FOLDER;
    }

    async deleteRows(ids) {
        return this.repositoryModuleManager.removeCommands(ids);
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
