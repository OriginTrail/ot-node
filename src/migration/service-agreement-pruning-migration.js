import BaseMigration from './base-migration.js';

class ServiceAgreementPruningMigration extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        repositoryModuleManager,
        blockchainModuleManager,
        serviceAgreementService,
    ) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
        this.serviceAgreementService = serviceAgreementService;
    }

    async executeMigration() {
        const blockchainIds = this.blockchainModuleManager.getImplementationNames();

        // eslint-disable-next-line no-await-in-loop
        for (const blockchainId of blockchainIds) {
            const assetStorageContractAddresses =
                // eslint-disable-next-line no-await-in-loop
                await this.blockchainModuleManager.getAssetStorageContractAddresses(blockchainId);

            // eslint-disable-next-line no-await-in-loop
            await this.repositoryModuleManager.removeServiceAgreementsByBlockchainAndContract(
                blockchainId,
                assetStorageContractAddresses[0],
            );
        }
    }
}
export default ServiceAgreementPruningMigration;
