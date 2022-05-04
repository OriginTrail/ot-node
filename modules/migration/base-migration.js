const appRootPath = require('app-root-path');
const path = require('path');
const fs = require('fs-extra');

const MIGRATION_FOLDER_NAME = 'migrations';

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
    }

    async migrationAlreadyExecuted() {
        const migrationFilePath = path.join(
            appRootPath.path,
            '..',
            this.config.appDataPath,
            MIGRATION_FOLDER_NAME,
            this.migrationName,
        );
        return fs.exists(migrationFilePath);
    }

    async finalizeMigration() {
        const migrationFolderPath = path.join(
            appRootPath.path,
            '..',
            this.config.appDataPath,
            MIGRATION_FOLDER_NAME,
        );
        await fs.ensureDir(migrationFolderPath);
        const migrationFilePath = path.join(migrationFolderPath, this.migrationName);
        await fs.writeFile(migrationFilePath, 'MIGRATED');
    }
}

module.exports = BaseMigration;
