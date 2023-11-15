/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';

const fixedServiceAgreements = [];
let wrongAgreementsCount = 0;
const MAX_BATCH_SIZE = 10000;
const CONCURRENCY = 200;

class ServiceAgreementsDataInspector extends BaseMigration {
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
                fixedServiceAgreements: [],
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
                    migrationInfo.fixedServiceAgreements.push(...fixedServiceAgreements);
                    migrationInfo.lastProcessedTokenId = serviceAgreement.tokenId;
                    await this.saveMigrationInfo(migrationInfo);
                    this.logger.trace(
                        `${this.migrationName} Last token id processed: ${migrationInfo.lastProcessedTokenId}. ` +
                            `Invalid Service Agreements: ${migrationInfo.fixedServiceAgreements.length}.`,
                    );
                }
            }

            processed += serviceAgreementsToProcess.length;
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
            wrongAgreementsCount += 1;
            fixedServiceAgreements.push({
                blockchain: serviceAgreement.blockchain,
                contract: serviceAgreement.assetStorageContractAddress,
                tokenId: serviceAgreement.tokenId,
                agreementId: updatedServiceAgreement.agreementId ?? serviceAgreement.agreementId,
                currentKeyword: serviceAgreement.keyword,
                correctKeyword: updatedServiceAgreement.keyword ?? serviceAgreement.keyword,
                currentAssertionId: serviceAgreement.assertionId,
                correctAssertionId:
                    updatedServiceAgreement.assertionId ?? serviceAgreement.assertionId,
                stateIndex: updatedServiceAgreement.stateIndex ?? serviceAgreement.stateIndex,
            });
        }
    }
}

export default ServiceAgreementsDataInspector;
