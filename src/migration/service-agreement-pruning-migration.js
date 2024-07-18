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

            const countOfServiceAgreementsToBeRemoved =
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.getCountOfServiceAgreementsByBlockchainAndContract(
                    blockchainId,
                    assetStorageContractAddresses[0],
                );

            // removeServiceAgreementsByBlockchainAndContract deletes in batches od 100_000
            const numberOfIteration = Math.ceil(countOfServiceAgreementsToBeRemoved / 100_000);
            for (let i = 0; i < numberOfIteration; i += 1) {
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.removeServiceAgreementsByBlockchainAndContract(
                    blockchainId,
                    assetStorageContractAddresses[0],
                );
            }
        }
    }
}
export default ServiceAgreementPruningMigration;
