/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';
import { TRIPLE_STORE } from '../constants/constants.js';

const fixedServiceAgreements = [];
const fixedHistoricalAssertions = [];
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
        if (!migrationInfo?.lastProcessedTokenId) {
            migrationInfo = {
                fixedServiceAgreements: [],
                fixedHistoricalAssertions: [],
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
                    migrationInfo.fixedHistoricalAssertions.push(...fixedHistoricalAssertions);
                    migrationInfo.lastProcessedTokenId = serviceAgreement.tokenId;
                    await this.saveMigrationInfo(migrationInfo);
                    this.logger.trace(
                        `${this.migrationName} Last token id processed: ${migrationInfo.lastProcessedTokenId}. ` +
                            `Invalid Service Agreements: ${migrationInfo.fixedServiceAgreements.length}. ` +
                            `Assets with Invalid Historical Assertions: ${migrationInfo.fixedHistoricalAssertions.length}.`,
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
        let isInvalid = false;

        const assertionIds = await this.blockchainModuleManager.getAssertionIds(
            serviceAgreement.blockchain,
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
        );

        const historicalAssertionIds = assertionIds.slice(0, -1);

        const publicHistoricalAssertionLinks = await this.tripleStoreService.getAssetAssertionLinks(
            TRIPLE_STORE.REPOSITORIES.PUBLIC_HISTORY,
            serviceAgreement.blockchain,
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
                TRIPLE_STORE.REPOSITORIES.PRIVATE_HISTORY,
                serviceAgreement.blockchain,
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
                blockchain: serviceAgreement.blockchain,
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
