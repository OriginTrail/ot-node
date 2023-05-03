import BaseMigration from './base-migration.js';

class MarkOldBlockchainEventsAsProcessedMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        this.logger.info('Marking old blockchain events as processed');
        const timestamp = Date.now();
        const query = `update blockchain_event
                       set processed = true
                       where created_at < FROM_UNIXTIME(${timestamp / 1000})`;
        await this.repositoryModuleManager.query(query);
    }
}

export default MarkOldBlockchainEventsAsProcessedMigration;
