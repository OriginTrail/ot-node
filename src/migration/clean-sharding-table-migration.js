import BaseMigration from './base-migration.js';
import { CONTRACTS } from '../constants/constants.js';

class CleanShardingTableMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
            this.logger.info('Removing all entries from local sharding table');
            await this.repositoryModuleManager.cleanShardingTable();
            await this.repositoryModuleManager.removeBlockchainEvents(
                CONTRACTS.SHARDING_TABLE_CONTRACT,
            );
        }
    }
}

export default CleanShardingTableMigration;
