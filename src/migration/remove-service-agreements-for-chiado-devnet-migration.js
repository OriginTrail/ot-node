import BaseMigration from './base-migration.js';

const GNOSIS_DEVNET_CHAIN_ID = 'gnosis:10200';

class RemoveServiceAgreementsForChiadoDevnetMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
    }

    async executeMigration() {
        await this.repositoryModuleManager.removeServiceAgreementsForBlockchain(
            GNOSIS_DEVNET_CHAIN_ID,
        );
    }
}

export default RemoveServiceAgreementsForChiadoDevnetMigration;
