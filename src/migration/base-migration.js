/* eslint-disable import/extensions */
import path from 'path';
import fs from 'fs-extra';
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
        if (await fs.exists(migrationFilePath)) {
            return true;
        }
        this.logger.info(`Starting ${this.migrationName} migration.`);
        this.startedTimestamp = Date.now();
        return false;
    }

    async finalizeMigration(migrationPath = null) {
        const migrationFolderPath = migrationPath || this.fileService.getMigrationFolderPath();
        await fs.ensureDir(migrationFolderPath);
        const migrationFilePath = path.join(migrationFolderPath, this.migrationName);
        await fs.writeFile(migrationFilePath, 'MIGRATED');
        this.logger.info(
            `${this.migrationName} migration completed. Lasted: ${
                Date.now() - this.startedTimestamp
            } millisecond(s).`,
        );
    }
}

export default BaseMigration;
