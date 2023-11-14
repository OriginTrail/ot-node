import path from 'path';
import FileService from '../service/file-service.js';

class BaseMigration {
    constructor(migrationName, logger, config) {
        if (!migrationName || migrationName === '') {
            throw new Error('Unable to initialize base migration: name not passed in constructor.');
        }
        if (!logger) {
            throw new Error(
                'Unable to initialize base migration: logger object not passed in constructor.',
            );
        }
        if (!config) {
            throw new Error(
                'Unable to initialize base migration: config object not passed in constructor.',
            );
        }
        this.migrationName = migrationName;
        this.logger = logger;
        this.config = config;
        this.fileService = new FileService({ config: this.config, logger: this.logger });
    }

    async migrationAlreadyExecuted() {
        const migrationFilePath = path.join(
            this.fileService.getMigrationFolderPath(),
            this.migrationName,
        );
        if (await this.fileService.pathExists(migrationFilePath)) {
            return true;
        }
        return false;
    }

    async migrate(migrationPath = null) {
        this.logger.info(`Starting ${this.migrationName} migration.`);
        this.startedTimestamp = Date.now();

        await this.executeMigration();

        const migrationFolderPath = migrationPath || this.fileService.getMigrationFolderPath();
        await this.fileService.writeContentsToFile(
            migrationFolderPath,
            this.migrationName,
            'MIGRATED',
        );
        this.logger.info(
            `${this.migrationName} migration completed. Lasted: ${
                Date.now() - this.startedTimestamp
            } millisecond(s).`,
        );
    }

    async getMigrationInfo() {
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_info`;
        const migrationInfoPath = path.join(migrationFolderPath, migrationInfoFileName);
        let migrationInfo = null;
        if (await this.fileService.pathExists(migrationInfoPath)) {
            migrationInfo = await this.fileService
                .readFile(migrationInfoPath, true)
                .catch(() => {});
        }
        return migrationInfo;
    }

    async saveMigrationInfo(migrationInfo) {
        const migrationFolderPath = this.fileService.getMigrationFolderPath();
        const migrationInfoFileName = `${this.migrationName}_info`;
        await this.fileService.writeContentsToFile(
            migrationFolderPath,
            migrationInfoFileName,
            JSON.stringify(migrationInfo),
            false,
        );
    }

    async executeMigration() {
        throw Error('Execute migration method not implemented');
    }
}

export default BaseMigration;
