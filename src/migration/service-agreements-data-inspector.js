/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import { TRIPLE_STORE_REPOSITORIES } from '../constants/constants.js';

let fixedServiceAgreements = [];
let fixedHistoricalAssertions = [];
const MAX_BATCH_SIZE = 10000;
const CONCURRENCY = 200;

class ServiceAgreementsDataInspector extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        blockchainModuleManager,
        repositoryModuleManager,
        tripleStoreService,
        ualService,
        serviceAgreementService,
    ) {
        super(migrationName, logger, config);
        this.blockchainModuleManager = blockchainModuleManager;
        this.repositoryModuleManager = repositoryModuleManager;
        this.tripleStoreService = tripleStoreService;
        this.ualService = ualService;
        this.serviceAgreementService = serviceAgreementService;
    }

    async executeMigration() {
        let migrationInfo = await this.getMigrationInfo();
        if (!migrationInfo?.lastProcessedTokenId || !migrationInfo?.processedServiceAgreements) {
            migrationInfo = {
                processedServiceAgreements: 0,
                lastProcessedTokenId: 0,
                fixedServiceAgreements: [],
                fixedHistoricalAssertions: [],
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

                const promisesBatchLength = promises.length;

                if (
                    promisesBatchLength >= CONCURRENCY ||
                    promisesBatchLength === serviceAgreementsToProcess.length
                ) {
                    try {
                        await Promise.all(promises);
                    } catch (error) {
                        this.logger.warn(
                            `Unable to process invalid service agreements. Error: ${error}`,
                        );
                    }
                    promises = [];
                    migrationInfo.processedServiceAgreements += promisesBatchLength;
                    migrationInfo.lastProcessedTokenId = serviceAgreement.tokenId;
                    migrationInfo.fixedServiceAgreements.push(...fixedServiceAgreements);
                    migrationInfo.fixedHistoricalAssertions.push(...fixedHistoricalAssertions);
                    fixedServiceAgreements = [];
                    fixedHistoricalAssertions = [];
                    await this.saveMigrationInfo(migrationInfo);
                    this.logger.trace(
                        `${this.migrationName} Processed Service Agreements: ${migrationInfo.processedServiceAgreements}, ` +
                            `Last token id processed: ${migrationInfo.lastProcessedTokenId}. ` +
                            `Invalid Service Agreements: ${migrationInfo.fixedServiceAgreements.length}. ` +
                            `Assets with Invalid Historical Assertions: ${migrationInfo.fixedHistoricalAssertions.length}.`,
                    );
                }
            }

            processed += serviceAgreementsToProcess.length;
        }

        const invalidServiceAgreementPercentage =
            (migrationInfo.fixedServiceAgreements.length / processed) * 100;
        const invalidHistoricalAssertionsPercentage =
            (migrationInfo.fixedHistoricalAssertions.length / processed) * 100;

        this.logger.trace(
            `${this.migrationName} Total number of processed Service Agreements: ${migrationInfo.processedServiceAgreements}. ` +
                `Found invalid Service Agreements: ${
                    migrationInfo.fixedServiceAgreements.length
                } (${invalidServiceAgreementPercentage.toFixed(2)}%), ` +
                `Found Assets with Invalid Historical Assertions: ${
                    migrationInfo.fixedHistoricalAssertions.length
                } (${invalidHistoricalAssertionsPercentage.toFixed(2)}%).`,
        );
    }

    async processServiceAgreement(serviceAgreement) {
        const updatedServiceAgreement = {};
        let isInvalid = false;

        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            serviceAgreement.blockchainId,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
        );

        const historicalAssertionIds = assertionIds.slice(0, -1);

        const publicHistoricalAssertionLinks = await this.tripleStoreService.getAssetAssertionLinks(
            TRIPLE_STORE_REPOSITORIES.PUBLIC_HISTORY,
            serviceAgreement.blockchainId,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
        );
        const publicHistoricalLinkedAssertionIds = publicHistoricalAssertionLinks.map(
            ({ assertion }) => assertion.replace('assertion:', ''),
        );
        const missingPublicHistoricalAssertions = historicalAssertionIds.filter(
            (element) => !publicHistoricalLinkedAssertionIds.includes(element),
        );
        const redundantPublicHistoricalAssertions = publicHistoricalLinkedAssertionIds.filter(
            (element) => !historicalAssertionIds.includes(element),
        );

        const privateHistoricalAssertionLinks =
            await this.tripleStoreService.getAssetAssertionLinks(
                TRIPLE_STORE_REPOSITORIES.PRIVATE_HISTORY,
                serviceAgreement.blockchainId,
                serviceAgreement.assetStorageContractAddress,
                serviceAgreement.tokenId,
            );
        const privateHistoricalLinkedAssertionIds = privateHistoricalAssertionLinks.map(
            ({ assertion }) => assertion.replace('assertion:', ''),
        );
        const missingPrivateHistoricalAssertions = historicalAssertionIds.filter(
            (element) => !privateHistoricalLinkedAssertionIds.includes(element),
        );
        const redundantPrivateHistoricalAssertions = privateHistoricalLinkedAssertionIds.filter(
            (element) => !historicalAssertionIds.includes(element),
        );

        const hasInvalidHistoricalAssertions = [
            missingPublicHistoricalAssertions,
            missingPrivateHistoricalAssertions,
            redundantPublicHistoricalAssertions,
            redundantPrivateHistoricalAssertions,
        ].some((array) => array.length > 0);

        if (hasInvalidHistoricalAssertions) {
            fixedHistoricalAssertions.push({
                blockchain: serviceAgreement.blockchainId,
                contract: serviceAgreement.assetStorageContractAddress,
                tokenId: serviceAgreement.tokenId,
                missingPublicHistoricalAssertions,
                missingPrivateHistoricalAssertions,
                redundantPublicHistoricalAssertions,
                redundantPrivateHistoricalAssertions,
            });
        }

        const stateIndex = assertionIds.length - 1;

        if (serviceAgreement.assertionId !== assertionIds[stateIndex]) {
            updatedServiceAgreement.assertionId = assertionIds[stateIndex];
            isInvalid = true;
        }

        if (serviceAgreement.stateIndex !== stateIndex) {
            updatedServiceAgreement.stateIndex = stateIndex;
            isInvalid = true;
        }

        const keyword = await this.ualService.calculateLocationKeyword(
            serviceAgreement.blockchainId,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
            assertionIds[0],
        );

        if (serviceAgreement.keyword !== keyword) {
            updatedServiceAgreement.keyword = keyword;
            isInvalid = true;
        }

        const agreementId = this.serviceAgreementService.generateId(
            serviceAgreement.blockchainId,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
            keyword,
            serviceAgreement.hashFunctionId,
        );

        if (serviceAgreement.agreementId !== agreementId) {
            updatedServiceAgreement.agreementId = agreementId;
            isInvalid = true;
        }

        if (isInvalid) {
            fixedServiceAgreements.push({
                blockchain: serviceAgreement.blockchainId,
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
