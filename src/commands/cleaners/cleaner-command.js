import { REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER } from '../../constants/constants.js';
import Command from '../command.js';

class CleanerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.archiveService = ctx.archiveService;
    }

    /**
     * Executes command and produces one or more events
     */
    async execute() {
        const nowTimestamp = Date.now();

        let rowsForRemoval = await this.findRowsForRemoval(nowTimestamp);

        while (rowsForRemoval?.length >= REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER) {
            const archiveName = this.getArchiveName(rowsForRemoval);

            // eslint-disable-next-line no-await-in-loop
            await this.archiveService.archiveData(
                this.getArchiveFolderName(),
                archiveName,
                rowsForRemoval,
            );

            // remove from database;
            const ids = rowsForRemoval.map((command) => command.id);
            // eslint-disable-next-line no-await-in-loop
            await this.deleteRows(ids);

            // eslint-disable-next-line no-await-in-loop
            rowsForRemoval = await this.findRowsForRemoval(nowTimestamp);
        }

        return Command.repeat();
    }

    getArchiveName(rowsForRemoval) {
        const firstTimestamp = new Date(rowsForRemoval[0].createdAt).getTime();
        const lastTimestamp = new Date(
            rowsForRemoval[rowsForRemoval.length - 1].createdAt,
        ).getTime();
        return `${firstTimestamp}-${lastTimestamp}.json`;
    }

    // eslint-disable-next-line no-unused-vars
    async findRowsForRemoval(nowTimestamp) {
        throw Error('findRowsForRemoval is not implemented.');
    }

    getArchiveFolderName() {
        throw Error('getArchiveFolderName is not implemented.');
    }

    // eslint-disable-next-line no-unused-vars
    async deleteRows(ids) {
        throw Error('deleteRows is not implemented.');
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(
            `Error occurred during the command execution; ` +
                `Error Message: ${error.message}. Repeating the command...`,
            command,
        );
        return Command.repeat();
    }
}

export default CleanerCommand;
