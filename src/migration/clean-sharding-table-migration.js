import BaseMigration from './base-migration.js';

class CleanShardingTableMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
            this.logger.info('Removing all entries from local sharding table');
            await this.repositoryModuleManager.cleanShardingTable();
        }
    }
}

export default CleanShardingTableMigration;
