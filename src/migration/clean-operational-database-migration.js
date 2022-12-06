import BaseMigration from './base-migration.js';

class CleanOperationalDatabaseMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
            this.logger.info('Dropping old operational database.');
            await this.repositoryModuleManager.dropDatabase();
        }
    }
}

export default CleanOperationalDatabaseMigration;
