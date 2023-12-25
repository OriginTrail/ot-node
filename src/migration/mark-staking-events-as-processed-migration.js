/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';

class MarkStakingEventsAsProcessedMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager, blockchainModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
    }

    async executeMigration() {
        this.logger.info('Marking old blockchain events as processed');
        for (const blockchain of this.blockchainModuleManager.getImplementationNames()) {
            const timestamp = Date.now();
            const block = await this.blockchainModuleManager.getLatestBlock(blockchain);
            const query = `update blockchain
                           set lastCheckedBlock     = ${block},
                               lastCheckedTimestamp = ${timestamp}
                           where blockchain_id = 'otp:2043'`;
            await this.repositoryModuleManager.query(query);
        }
    }
}

export default MarkStakingEventsAsProcessedMigration;
