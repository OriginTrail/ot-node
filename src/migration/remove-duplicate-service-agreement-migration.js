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
            const duplicateTokenIds =
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.findDuplicateServiceAgreements(blockchainId);
            const findDuplicateServiceAgreements =
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.findServiceAgreementsByTokenIds(
                    duplicateTokenIds,
                    blockchainId,
                );
            for (const serviceAgreement of findDuplicateServiceAgreements) {
                const blockchainAssertionId =
                    // eslint-disable-next-line no-await-in-loop
                    await this.blockchainModuleManager.getAssertionIdByIndex(
                        blockchainId,
                        serviceAgreement.asset_storage_contract_address,
                        serviceAgreement.token_id,
                        0,
                    );
                if (serviceAgreement.assertion_id !== blockchainAssertionId) {
                    incorrectServiceAgreementId.push(serviceAgreement.agreement_id);
                }
            }
            // eslint-disable-next-line no-await-in-loop
            await this.repositoryModuleManager.removeServiceAgreements(incorrectServiceAgreementId);
        }
    }
}
export default RemoveDuplicateServiceAgreementMigration;
