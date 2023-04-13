import BaseMigration from './base-migration.js';
import { CONTRACTS, NODE_ENVIRONMENTS } from '../constants/constants.js';

class CleanShardingTableMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        if (
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.DEVELOPMENT &&
            process.env.NODE_ENV !== NODE_ENVIRONMENTS.TEST
        ) {
            this.logger.info('Removing all entries from local sharding table');
            await this.repositoryModuleManager.cleanShardingTable();
            await this.repositoryModuleManager.removeBlockchainEvents(
                CONTRACTS.SHARDING_TABLE_CONTRACT,
            );
            await this.repositoryModuleManager.removeLastCheckedBlockForContract(
                CONTRACTS.SHARDING_TABLE_CONTRACT,
            );
        }
    }
}

export default CleanShardingTableMigration;
