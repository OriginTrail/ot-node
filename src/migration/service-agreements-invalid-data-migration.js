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
                    `Service Agreement ID: ${serviceAgreement.agreementId}, Keyword: ${serviceAgreement.keyword}, Assertion ID: ${serviceAgreement.assertionId}, State Index: ${serviceAgreement.stateIndex}.`,
            );

            await this.repositoryModuleManager.updateServiceAgreementForTokenId(
                serviceAgreement.tokenId,
                serviceAgreement.agreementId,
                serviceAgreement.keyword,
                serviceAgreement.assertionId,
                serviceAgreement.stateIndex,
            );

            if (serviceAgreement.invalidAssertionId === serviceAgreement.assertionId) {
                continue;
            }

            if (
                await this.tripleStoreService.assetAssertionLinkExists(
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                    serviceAgreement.invalidAssertionId,
                )
            ) {
                this.logger.trace(
                    `Fixing Service Agreement in the Triple Store (repository: ${TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT}) for the Knowledge Asset with the ID: ` +
                        `${serviceAgreement.tokenId}, Service Agreement ID: ${serviceAgreement.agreementId}, ` +
                        `Keyword: ${serviceAgreement.keyword}, Assertion ID: ${serviceAgreement.assertionId}, State Index: ${serviceAgreement.stateIndex}.`,
                );

                await this.tripleStoreService.updateAssetAssertionLink(
                    TRIPLE_STORE_REPOSITORIES.PUBLIC_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                    serviceAgreement.invalidAssertionId,
                    serviceAgreement.assertionId,
                );
            } else if (
                await this.tripleStoreService.assetAssertionLinkExists(
                    TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                    serviceAgreement.invalidAssertionId,
                )
            ) {
                this.logger.trace(
                    `Fixing Service Agreement in the Triple Store (repository: ${TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT}) for the Knowledge Asset with the ID: ` +
                        `${serviceAgreement.tokenId}, Service Agreement ID: ${serviceAgreement.agreementId}, ` +
                        `Keyword: ${serviceAgreement.keyword}, Assertion ID: ${serviceAgreement.assertionId}, State Index: ${serviceAgreement.stateIndex}.`,
                );

                await this.tripleStoreService.updateAssetAssertionLink(
                    TRIPLE_STORE_REPOSITORIES.PRIVATE_CURRENT,
                    serviceAgreement.blockchain,
                    serviceAgreement.contract,
                    serviceAgreement.tokenId,
                    serviceAgreement.invalidAssertionId,
                    serviceAgreement.assertionId,
                );
            }
        }
    }
}

export default ServiceAgreementsInvalidDataMigration;
