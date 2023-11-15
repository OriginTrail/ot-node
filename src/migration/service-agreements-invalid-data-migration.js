/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import { TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

class ServiceAgreementsInvalidDataMigration extends BaseMigration {
    constructor(migrationName, logger, config, repositoryModuleManager, tripleStoreService) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.tripleStoreService = tripleStoreService;
    }

    async executeMigration() {
        let migrationInfo = await this.getMigrationInfo();
        if (!migrationInfo?.lastFixedTokenId) {
            migrationInfo = {
                lastFixedTokenId: 0,
            };
        }

        const serviceAgreementsDataInspectorInfo = await this.getMigrationInfo(
            'serviceAgreementsDataInspector',
        );
        const serviceAgreementsToUpdate =
            serviceAgreementsDataInspectorInfo.fixedServiceAgreements.sort(
                (a, b) => a.tokenId - b.tokenId,
            );

        for (const serviceAgreement of serviceAgreementsToUpdate) {
            if (serviceAgreement.tokenId < migrationInfo.lastFixedTokenId) {
                continue;
            }

            this.logger.trace(
                `Fixing Service Agreement in the Operational DB for the Knowledge Asset with the ID: ${serviceAgreement.tokenId}, ` +
                    `Service Agreement ID: ${serviceAgreement.agreementId}, Keyword: ${serviceAgreement.correctKeyword}, ` +
                    `Assertion ID: ${serviceAgreement.correctAssertionId}, State Index: ${serviceAgreement.stateIndex}.`,
            );

            await this.repositoryModuleManager.updateServiceAgreementForTokenId(
                serviceAgreement.tokenId,
                serviceAgreement.agreementId,
                serviceAgreement.correctKeyword,
                serviceAgreement.correctAssertionId,
                serviceAgreement.stateIndex,
            );

            // Fix wrong Assertion links in the PublicCurrent / PrivateCurrent repositories
            if (serviceAgreement.currentAssertionId !== serviceAgreement.correctAssertionId) {
                const assertionLinkedInPublicCurrentRepository =
                    await this.tripleStoreService.assetAssertionLinkExists(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                    );

                if (assertionLinkedInPublicCurrentRepository) {
                    await this.tripleStoreService.updateAssetAssertionLink(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                        serviceAgreement.correctAssertionId,
                    );
                }

                const assertionLinkedInPrivateCurrentRepository =
                    await this.tripleStoreService.assetAssertionLinkExists(
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                    );

                if (assertionLinkedInPrivateCurrentRepository) {
                    await this.tripleStoreService.updateAssetAssertionLink(
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                        serviceAgreement.correctAssertionId,
                    );
                }
            }

            // Fix wrong keyword for the Asset Metadata in the PublicCurrent / PrivateCurrent repository
            if (serviceAgreement.currentKeyword !== serviceAgreement.correctKeyword) {
                const assetInPublicCurrentRepository = await this.tripleStoreService.assetExists(
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                );

                if (assetInPublicCurrentRepository) {
                    await this.tripleStoreService.updateAssetNonAssertionMetadata(
                        TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.correctKeyword,
                    );
                }

                const assetInPrivateCurrentRepository = await this.tripleStoreService.assetExists(
                    TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                );

                if (assetInPrivateCurrentRepository) {
                    await this.tripleStoreService.updateAssetNonAssertionMetadata(
                        TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.correctKeyword,
                    );
                }
            }
        }
    }
}

export default ServiceAgreementsInvalidDataMigration;
