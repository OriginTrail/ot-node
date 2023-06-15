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
     * @param command
     */
    async execute() {
        const nowTimestamp = Date.now();

        let rowsForRemoval = await this.findRowsForRemoval(nowTimestamp);

        while (rowsForRemoval?.length >= REPOSITORY_ROWS_FOR_REMOVAL_MAX_NUMBER) {
            const archiveName = `${rowsForRemoval[0].startedAt}-${
                rowsForRemoval[rowsForRemoval.length - 1].startedAt
            }.json`;

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

    // eslint-disable-next-line no-unused-vars
    async findRowsForRemoval(nowTimestamp) {
        throw Error('findRowsForRemoval not implemented');
    }

    getArchiveFolderName() {
        throw Error('getArchiveFolderName not implemented');
    }

    // eslint-disable-next-line no-unused-vars
    async deleteRows(ids) {
        throw Error('deleteRows not implemented');
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        this.logger.warn(`Failed to clean operational db data: error: ${error.message}`);
        return Command.repeat();
    }
}

export default CleanerCommand;
