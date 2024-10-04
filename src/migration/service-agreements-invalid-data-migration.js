/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import { TRIPLE_STORE } from '../constants/constants.js';

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

        // Fixing invalid Service Agreements in the Operational DB (agreementId + keyword + assertionId + stateIndex) +
        // Current repositories of the Triple Store ([Metadata: keyword] + [Assertion Links])
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
                        TRIPLE_STORE.REPOSITORIES.PUBLIC_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                    );

                if (assertionLinkedInPublicCurrentRepository) {
                    await this.tripleStoreService.updateAssetAssertionLink(
                        TRIPLE_STORE.REPOSITORIES.PUBLIC_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                        serviceAgreement.correctAssertionId,
                    );
                }

                const assertionLinkedInPrivateCurrentRepository =
                    await this.tripleStoreService.assetAssertionLinkExists(
                        TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                    );

                if (assertionLinkedInPrivateCurrentRepository) {
                    await this.tripleStoreService.updateAssetAssertionLink(
                        TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.currentAssertionId,
                        serviceAgreement.correctAssertionId,
                    );
                }
            }

            // Fix wrong keyword for the Asset Metadata in the Triple Store
            if (serviceAgreement.currentKeyword !== serviceAgreement.correctKeyword) {
                const assetInPublicCurrentRepository = await this.tripleStoreService.assetExists(
                    TRIPLE_STORE.REPOSITORIES.PUBLIC_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                );

                if (assetInPublicCurrentRepository) {
                    await this.tripleStoreService.updateAssetNonAssertionMetadata(
                        TRIPLE_STORE.REPOSITORIES.PUBLIC_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.correctKeyword,
                    );
                }

                const assetInPrivateCurrentRepository = await this.tripleStoreService.assetExists(
                    TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                );

                if (assetInPrivateCurrentRepository) {
                    await this.tripleStoreService.updateAssetNonAssertionMetadata(
                        TRIPLE_STORE.REPOSITORIES.PRIVATE_CURRENT,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.correctKeyword,
                    );
                }

                const assetInPublicHistoricalRepository = await this.tripleStoreService.assetExists(
                    TRIPLE_STORE.REPOSITORIES.PUBLIC_HISTORY,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                );

                if (assetInPublicHistoricalRepository) {
                    await this.tripleStoreService.updateAssetNonAssertionMetadata(
                        TRIPLE_STORE.REPOSITORIES.PUBLIC_HISTORY,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.correctKeyword,
                    );
                }

                const assetInPrivateHistoricalRepository =
                    await this.tripleStoreService.assetExists(
                        TRIPLE_STORE.REPOSITORIES.PRIVATE_HISTORY,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                    );

                if (assetInPrivateHistoricalRepository) {
                    await this.tripleStoreService.updateAssetNonAssertionMetadata(
                        TRIPLE_STORE.REPOSITORIES.PRIVATE_HISTORY,
                        serviceAgreement.blockchain,
                        serviceAgreement.contract,
                        serviceAgreement.tokenId,
                        serviceAgreement.correctKeyword,
                    );
                }
            }
        }

        // Fixing invalid Historical Assertions ([Assertion Links])
        const historicalStatesToUpdate =
            serviceAgreementsDataInspectorInfo.fixedHistoricalAssertions.sort(
                (a, b) => a.tokenId - b.tokenId,
            );
        for (const state of historicalStatesToUpdate) {
            if (state.tokenId < migrationInfo.lastFixedTokenId) {
                continue;
            }

            for (const assertionId of state.missingPublicHistoricalAssertions) {
                await this.tripleStoreService.insertAssetAssertionLink(
                    TRIPLE_STORE.REPOSITORIES.PUBLIC_HISTORY,
                    state.blockchain,
                    state.contract,
                    state.tokenId,
                    assertionId,
                );
            }

            for (const assertionId of state.missingPrivateHistoricalAssertions) {
                await this.tripleStoreService.insertAssetAssertionLink(
                    TRIPLE_STORE.REPOSITORIES.PRIVATE_HISTORY,
                    state.blockchain,
                    state.contract,
                    state.tokenId,
                    assertionId,
                );
            }

            for (const assertionId of state.redundantPublicHistoricalAssertions) {
                await this.tripleStoreService.deleteAssetAssertionLink(
                    TRIPLE_STORE.REPOSITORIES.PUBLIC_HISTORY,
                    state.blockchain,
                    state.contract,
                    state.tokenId,
                    assertionId,
                );
            }

            for (const assertionId of state.redundantPrivateHistoricalAssertions) {
                await this.tripleStoreService.deleteAssetAssertionLink(
                    TRIPLE_STORE.REPOSITORIES.PRIVATE_HISTORY,
                    state.blockchain,
                    state.contract,
                    state.tokenId,
                    assertionId,
                );
            }
        }
    }
}

export default ServiceAgreementsInvalidDataMigration;
