import BaseMigration from './base-migration.js';
import { NODE_ENVIRONMENTS, CONTENT_ASSET_HASH_FUNCTION_ID } from '../constants/constants.js';

const NUMBER_OF_ASSETS_FROM_DB = 1_000_000;
const BATCH_FOR_RPC_CALLS = 25;

class ServiceAgreementFixMigration extends BaseMigration {
    constructor(
        migrationName,
        logger,
        config,
        repositoryModuleManager,
        blockchainModuleManager,
        serviceAgreementService,
    ) {
        super(migrationName, logger, config);
        this.repositoryModuleManager = repositoryModuleManager;
        this.blockchainModuleManager = blockchainModuleManager;
        this.serviceAgreementService = serviceAgreementService;
    }

    async executeMigration() {
        let blockchainId;
        switch (process.env.NODE_ENV) {
            case NODE_ENVIRONMENTS.DEVNET:
                blockchainId = 'otp:2160';
                break;
            case NODE_ENVIRONMENTS.TESTNET:
                blockchainId = 'otp:20430';
                break;
            case NODE_ENVIRONMENTS.MAINENET:
            default:
                blockchainId = 'otp:2043';
        }

        // Get count of service agreement for neuroweb
        const serviceAgreementCount =
            await this.repositoryModuleManager.getCountOfServiceAgreementsByBlockchain(
                blockchainId,
            );

        //    In batches
        const numberOfIteration = Math.ceil(serviceAgreementCount / NUMBER_OF_ASSETS_FROM_DB);
        for (let i = 0; i < numberOfIteration; i += 1) {
            let serviceAgreementToBeUpdated = [];
            const serviceAgreementBatch =
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.getServiceAgreementsByBlockchainInBatches(
                    blockchainId,
                    NUMBER_OF_ASSETS_FROM_DB,
                    i * NUMBER_OF_ASSETS_FROM_DB,
                );
            for (let j = 0; j < serviceAgreementBatch.length; j += BATCH_FOR_RPC_CALLS) {
                const currentBatch = serviceAgreementBatch.slice(j, j + BATCH_FOR_RPC_CALLS);

                const batchPromises = currentBatch.map((serviceAgreement) =>
                    this.compareDataWithOnChainData(serviceAgreement),
                );
                // eslint-disable-next-line no-await-in-loop
                const results = await Promise.all(batchPromises);

                const mismatches = results.filter((result) => result !== null);

                if (mismatches.length > 0) {
                    this.logger.trace(`Mismatches found: ${mismatches.length}`);
                    serviceAgreementToBeUpdated = serviceAgreementToBeUpdated.concat(mismatches);
                }
            }
            if (serviceAgreementToBeUpdated.length > 0) {
                // eslint-disable-next-line no-await-in-loop
                await this.repositoryModuleManager.updateAssertionIdServiceAgreement(
                    blockchainId,
                    serviceAgreementToBeUpdated,
                );
            }
        }
    }

    async compareDataWithOnChainData(serviceAgreement) {
        let assertionId;
        try {
            assertionId = await this.blockchainModuleManager.getAssertionIdByIndex(
                serviceAgreement.blockchainId,
                serviceAgreement.assetStorageContractAddress,
                serviceAgreement.tokenId,
                0,
            );
        } catch (error) {
            this.logger.warn(
                `Unable to fetch assertionIdfor token id: ${serviceAgreement.tokenId}`,
            );
            return null;
        }

        if (serviceAgreement.asssertionId !== assertionId) {
            const serviceAgreementId = this.serviceAgreementService.generateId(
                serviceAgreement.blockchainId,
                serviceAgreement.assetStorageContractAddress,
                serviceAgreement.tokenId,
                assertionId,
                CONTENT_ASSET_HASH_FUNCTION_ID, // 1 - sha256
            );
            return {
                tokenId: serviceAgreement.tokenId,
                assertionId,
                serviceAgreementId,
            };
        }
        return null;
    }
}

export default ServiceAgreementFixMigration;
