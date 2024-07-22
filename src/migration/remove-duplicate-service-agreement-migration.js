import BaseMigration from './base-migration.js';

class RemoveDuplicateServiceAgreementMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager, blockchainModuleManager) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
    }

    async executeMigration() {
        const blockchainIds = this.blockchainModuleManager.getImplementationNames();

        for (const blockchainId of blockchainIds) {
            const incorrectServiceAgreementId = [];
            const duplicateTokenIdsRestult =
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.findDuplicateServiceAgreements(blockchainId);
            const duplicateTokenIds = duplicateTokenIdsRestult.map((t) => t.dataValues.token_id);
            const findDuplicateServiceAgreements =
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.findServiceAgreementsByTokenIds(
                    duplicateTokenIds,
                    blockchainId,
                );
            for (const serviceAgreement of findDuplicateServiceAgreements) {
                try {
                    const blockchainAssertionId =
                        // eslint-disable-next-line no-await-in-loop
                        await this.blockchainModuleManager.getAssertionIdByIndex(
                            blockchainId,
                            serviceAgreement.assetStorageContractAddress,
                            serviceAgreement.tokenId,
                            serviceAgreement.stateIndex,
                        );
                    if (serviceAgreement.assertionId !== blockchainAssertionId) {
                        incorrectServiceAgreementId.push(serviceAgreement.agreementId);
                    }
                } catch (error) {
                    incorrectServiceAgreementId.push(serviceAgreement.agreementId);
                }
            }
            // eslint-disable-next-line no-await-in-loop
            await this.repositoryModuleManager.removeServiceAgreements(incorrectServiceAgreementId);
        }
    }
}
export default RemoveDuplicateServiceAgreementMigration;
