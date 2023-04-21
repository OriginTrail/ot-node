import BaseMigration from './base-migration.js';

class MarkOldBlockchainEventsAsProcessedMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        try {
            this.logger.info('Marking blockchain events older than 1 hour as processed');
            const timestamp = Date.now() - 1000 * 60 * 60; // 1 hour
            const query = `update blockchain_event
                       set processed = true
                       where created_at < ${timestamp}`;
            await this.repositoryModuleManager.query(query);
        } catch (error) {
            this.logger.warn(
                `Unable to mark blockchain events as processed. Error: ${error.message}`,
            );
        }
    }
}

export default MarkOldBlockchainEventsAsProcessedMigration;
