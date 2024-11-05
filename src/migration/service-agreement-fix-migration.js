// import BaseMigration from './base-migration.js';
// import NODE_ENVIRONMENTS from '../constants/constants.js';

// const NUMBER_OF_ASSETS_FROM_DB = 1_000_000;
// const BATCH_FOR_RPC_CALLS = 500;

// class ServiceAgreementPruningMigration extends BaseMigration {
//     constructor(
//         migrationName,
//         logger,
//         config,
//         repositoryModuleManager,
//         blockchainModuleManager,
//         serviceAgreementService,
//     ) {
//         super(migrationName, logger, config);
//         this.repositoryModuleManager = repositoryModuleManager;
//         this.blockchainModuleManager = blockchainModuleManager;
//         this.serviceAgreementService = serviceAgreementService;
//     }

//     async executeMigration() {
//         let blockchainId;
//         switch (process.env.NODE_ENV) {
//             case NODE_ENVIRONMENTS.DEVNET:
//                 blockchainId = 'otp:2160';
//                 break;
//             case NODE_ENVIRONMENTS.TESTNET:
//                 blockchainId = 'otp:20430';
//                 break;
//             case NODE_ENVIRONMENTS.MAINENET:
//             default:
//                 blockchainId = 'otp:2043';
//         }

//         // Get count of service agreement for neuroweb
//         const serviceAgreementCount = await this.getCountOfServiceAgreementsByBlockchain(
//             blockchainId,
//         );

//         //    In batches
//         const numberOfIteration = Math.ceil(serviceAgreementCount / NUMBER_OF_ASSETS_FROM_DB);
//         for (let i = 0; i < numberOfIteration; i += 1) {
//             //    get assertionId from chain for those tokenIds in BATCH_FOR_RPC_CALLS batch
//             const serviceAgreementBatch =
//                 this.repositoryModuleManager.getServiceAgreementsByBlockchainInBatches(
//                     blockchainId,
//                     NUMBER_OF_ASSETS_FROM_DB,
//                     i * NUMBER_OF_ASSETS_FROM_DB,
//                 );
//             for (
//                 let j = 0;
//                 j < BATCH_FOR_RPC_CALLS || j < serviceAgreementBatch.length;
//                 i += BATCH_FOR_RPC_CALLS
//             ) {
//                 const currentBatch = serviceAgreementBatch.slice(j, j + BATCH_FOR_RPC_CALLS);

//                 const batchPromises = currentBatch.map((serviceAgreement) =>
//                     this.compareDataWithOnChainData(serviceAgreement),
//                 );

//                 // Await all promises in the current batch
//                 const results = await Promise.all(batchPromises);

//                 // Filter out any null or undefined results (if compareDataWithOnChainData returns only mismatches)
//                 const mismatches = results.filter(
//                     (result) => result !== null && result !== undefined,
//                 );

//                 // Process mismatches if needed
//                 if (mismatches.length > 0) {
//                     console.log('Mismatches found:', mismatches);
//                     // Add any logic to handle or save mismatches
//                 }
//             }
//             //    If assertionId doesn't match one from chain calculate new one
//             // Update NUMBER_OF_ASSETS_FROM_DB assets
//             /*
//             UPDATE service_agreement
//             SET value = CASE
//                 WHEN id = 1 THEN 'a'
//                 WHEN id = 2 THEN 'c'
//                 WHEN id = 3 THEN 'b'
//                 WHEN id = 4 THEN 'd'
//                 ELSE value
//             END
//             WHERE id IN (1, 2, 3, 4);
//           */
//         }
//     }

//     async compareDataWithOnChainData(serviceAgreement) {
//         assertionIds = await this.blockchainModuleManager.getAssertionIds(
//             blockchain,
//             contract,
//             tokenId,
//         );
//         firstAssertionId = assertionIds[0];

//         if (serviceAgreement.asssertionId !== firstAssertionId) {
//             const serviceAgreement = this.serviceAgreementService.generateId(
//                 blockchain,
//                 assetTypeContract,
//                 tokenId,
//                 keyword,
//                 hashFunctionId,
//             );
//             return {
//                 tokenId: serviceAgreement.tokenId,
//                 assertionId: firstAssertionId,
//                 serviceAgreement,
//             };
//         }
//     }
// }

// export default ServiceAgreementPruningMigration;
