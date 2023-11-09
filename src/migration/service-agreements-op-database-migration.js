/* eslint-disable no-await-in-loop */
import BaseMigration from './base-migration.js';

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
            numberOfActiveServiceAgreements > 10000 ? 10000 : numberOfActiveServiceAgreements;
        const concurrency = 3;

        while (processed < numberOfActiveServiceAgreements) {
            const serviceAgreementsToProcess =
                await this.repositoryModuleManager.getServiceAgreements(
                    migrationInfo.lastProcessedTokenId,
                    batchSize,
                );

            let promises = [];

            for (const serviceAgreement of serviceAgreementsToProcess) {
                promises.push(this.processServiceAgreement(serviceAgreement));

                if (promises.length >= concurrency) {
                    // eslint-disable-next-line no-await-in-loop
                    await Promise.all(promises);
                    promises = [];
                    migrationInfo.lastProcessedTokenId =
                        serviceAgreementsToProcess.slice(-1)[0].tokenId;
                    await this.saveMigrationInfo(migrationInfo);
                    this.logger.trace(
                        `${this.migrationName} Last token id processed ${migrationInfo.lastProcessedTokenId}.`,
                    );
                }
            }

            processed += batchSize;
        }
    }

    async processServiceAgreement(serviceAgreement) {
        const updatedServiceAgreement = serviceAgreement;
        let updated = false;
        const keyword = await this.ualService.calculateLocationKeyword(
            updatedServiceAgreement.blockchainId,
            updatedServiceAgreement.assetStorageContractAddress,
            updatedServiceAgreement.tokenId,
        );

        if (serviceAgreement.keyword !== keyword) {
            updatedServiceAgreement.keyword = keyword;
            updated = true;
        }

        const agreementId = await this.serviceAgreementService.generateId(
            updatedServiceAgreement.blockchainId,
            updatedServiceAgreement.assetStorageContractAddress,
            updatedServiceAgreement.tokenId,
            keyword,
            updatedServiceAgreement.hashFunctionId,
        );

        if (serviceAgreement.agreementId !== agreementId) {
            updatedServiceAgreement.agreementId = agreementId;
            updated = true;
        }

        const assertionIds = this.blockchainModuleManager.getAssertionIds(
            serviceAgreement.assetStorageContractAddress,
            serviceAgreement.tokenId,
        );
        const stateIndex = assertionIds.length - 1;

        if (updatedServiceAgreement.assertionId !== assertionIds[stateIndex]) {
            updatedServiceAgreement.assertionId = assertionIds[stateIndex];
            updated = true;
        }

        if (updatedServiceAgreement.stateIndex !== stateIndex) {
            updatedServiceAgreement.stateIndex = stateIndex;
            updated = true;
        }
        if (updated) {
            await this.repositoryModuleManager.updateServiceAgreementRecord(
                updatedServiceAgreement.blockchainId,
                updatedServiceAgreement.assetStorageContractAddress,
                updatedServiceAgreement.tokenId,
                updatedServiceAgreement.agreementId,
                updatedServiceAgreement.startTime,
                updatedServiceAgreement.epochsNumber,
                updatedServiceAgreement.epochLength,
                updatedServiceAgreement.scoreFunctionId,
                updatedServiceAgreement.proofWindowOffsetPerc,
                updatedServiceAgreement.hashFunctionId,
                updatedServiceAgreement.keyword,
                updatedServiceAgreement.assertionId,
                updatedServiceAgreement.stateIndex,
                updatedServiceAgreement.lastCommitEpoch,
                updatedServiceAgreement.lastProofEpoch,
            );
        }
    }
}

export default ServiceAgreementsOpDatabaseMigration;
