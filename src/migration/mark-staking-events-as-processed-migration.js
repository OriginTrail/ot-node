import BaseMigration from './base-migration.js';

class MarkStakingEventsAsProcessedMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        this.logger.info('Marking old blockchain events as processed');
        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            const timestamp = Date.now();
            const block = this.blockchainModuleManager.getLatestBlock(blockchain);
            const query = `update blockchain
                           set lastCheckedBlock     = ${block},
                               lastCheckedTimestamp = ${timestamp}
                           where contract = 'StakingContract'`;
            // eslint-disable-next-line no-await-in-loop
            await this.repositoryModuleManager.query(query);
        }
    }
}

export default MarkStakingEventsAsProcessedMigration;
