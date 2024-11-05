import BaseMigration from './base-migration.js';
import NODE_ENVIRONMENTS from '../constants/constants.js';

const NUMBER_OF_ASSETS_FROM_DB = 1_000_000;
// const BATCH_FOR_RPC_CALLS = 1000;

class ServiceAgreementPruningMigration extends BaseMigration {
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
        const serviceAgreementCount = this.getCountOfServiceAgreementsByBlockchain(blockchainId);

        //    In batches
        const numberOfIteration = Math.ceil(serviceAgreementCount / NUMBER_OF_ASSETS_FROM_DB);
        for (let i = 0; i < numberOfIteration; i += 1) {
            //    get assertionId from chain for those tokenIds in BATCH_FOR_RPC_CALLS batch
            //    If assertionId doesn't match one from chain calculate new one
            // Update NUMBER_OF_ASSETS_FROM_DB assets
            /* 
            UPDATE service_agreement
            SET value = CASE 
                WHEN id = 1 THEN 'a'
                WHEN id = 2 THEN 'c'
                WHEN id = 3 THEN 'b'
                WHEN id = 4 THEN 'd'
                ELSE value 
            END
            WHERE id IN (1, 2, 3, 4);
          */
        }
    }
}
export default ServiceAgreementPruningMigration;
