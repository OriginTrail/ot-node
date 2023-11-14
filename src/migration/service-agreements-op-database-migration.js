/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';

let wrongAgreementsCount = 0;
const MAX_BATCH_SIZE = 10000;
const CONCURRENCY = 15;

class ServiceAgreementsOpDatabaseMigration extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        blockchainModuleManager,
        repositoryModuleManager,
        serviceAgreementService,
        ualService,
    ) {
        super(migrationName, logger, config);
        this.blockchainModuleManager = blockchainModuleManager;
        this.repositoryModuleManager = repositoryModuleManager;
        this.serviceAgreementService = serviceAgreementService;
        this.ualService = ualService;
    }

    async executeMigration() {
        let migrationInfo = await this.getMigrationInfo();
        if (!migrationInfo?.lastProcessedTokenId) {
            migrationInfo = {
                lastProcessedTokenId: 0,
            };
        }

        const numberOfActiveServiceAgreements =
            await this.repositoryModuleManager.getNumberOfActiveServiceAgreements();
        let processed = 0;
        const batchSize =
            numberOfActiveServiceAgreements > MAX_BATCH_SIZE
                ? MAX_BATCH_SIZE
                : numberOfActiveServiceAgreements;

        while (processed < numberOfActiveServiceAgreements) {
            const serviceAgreementsToProcess =
                await this.repositoryModuleManager.getServiceAgreements(
                    migrationInfo.lastProcessedTokenId,
                    batchSize,
                );
            let promises = [];

            for (const serviceAgreement of serviceAgreementsToProcess) {
                promises.push(this.processServiceAgreement(serviceAgreement));

                if (
                    promises.length >= CONCURRENCY ||
                    promises.length === serviceAgreementsToProcess.length
                ) {
                    try {
                        await Promise.all(promises);
                    } catch (error) {
                        this.logger.warn(
                            `Unable to process invalid service agreements. Error: ${error}`,
                        );
                    }
                    promises = [];
                    migrationInfo.lastProcessedTokenId = serviceAgreement.tokenId;
                    await this.saveMigrationInfo(migrationInfo);
                    this.logger.trace(
                        `${this.migrationName} Last token id processed ${migrationInfo.lastProcessedTokenId}.`,
                    );
                }
            }

            processed += batchSize;
        }

        this.logger.trace(
            `${this.migrationName} Total number of processed agreements ${processed}. Found invalid agreements: ${wrongAgreementsCount}`,
        );
    }

    async processServiceAgreement(serviceAgreement) {
        const updatedServiceAgreement = {};
        let updated = false;

        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            serviceAgreement.blockchain,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
        );

        const stateIndex = assertionIds.length - 1;

        if (serviceAgreement.assertionId !== assertionIds[stateIndex]) {
            updatedServiceAgreement.assertionId = assertionIds[stateIndex];
            updated = true;
        }

        if (serviceAgreement.stateIndex !== stateIndex) {
            updatedServiceAgreement.stateIndex = stateIndex;
            updated = true;
        }

        const keyword = await this.ualService.calculateLocationKeyword(
            serviceAgreement.blockchainId,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
            assertionIds[0],
        );

        if (serviceAgreement.keyword !== keyword) {
            updatedServiceAgreement.keyword = keyword;
            updated = true;
        }

        const agreementId = await this.serviceAgreementService.generateId(
            serviceAgreement.blockchainId,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
            keyword,
            serviceAgreement.hashFunctionId,
        );

        if (serviceAgreement.agreementId !== agreementId) {
            updatedServiceAgreement.agreementId = agreementId;
            updated = true;
        }

        if (updated) {
            await this.repositoryModuleManager.updateServiceAgreementForTokenId(
                serviceAgreement.tokenId,
                updatedServiceAgreement.agreementId ?? serviceAgreement.agreementId,
                updatedServiceAgreement.keyword ?? serviceAgreement.keyword,
                updatedServiceAgreement.assertionId ?? serviceAgreement.assertionId,
                updatedServiceAgreement.stateIndex ?? serviceAgreement.stateIndex,
            );
            wrongAgreementsCount += 1;
        }
    }
}

export default ServiceAgreementsOpDatabaseMigration;
