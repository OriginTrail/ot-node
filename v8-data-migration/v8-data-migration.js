import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import {
    DKG_REPOSITORY,
    BATCH_SIZE,
    ENV_PATH,
    BLOCKCHAINS,
    DATA_MIGRATION_DIR,
} from './constants.js';
import {
    updateCsvFile,
    initializeConfig,
    getCsvDataStream,
    getHighestTokenId,
    ensureDirectoryExists,
    ensureMigrationProgressFileExists,
    markMigrationAsSuccessfull,
    getTokenIdsToProcessCount,
} from './v8-data-migration-utils.js';
import {
    repositoryExists,
    createDkgRepository,
    getAssertionFromV6TripleStore,
    insertAssertionsIntoV8UnifiedRepository,
    deleteRepository,
    getTripleStoreData,
    initializeRepositories,
    initializeContexts,
    ensureConnections,
    getKnowledgeCollectionNamedGraphsExist,
} from './triple-store-utils.js';
import { getContentAssetStorageContract, initializeRpc } from './blockchain-utils.js';
import {
    validateBlockchainName,
    validateBlockchainDetails,
    validateTokenId,
    validateTripleStoreRepositories,
    validateTripleStoreImplementation,
    validateTripleStoreConfig,
    validateBatchData,
} from './validation.js';
import logger from './logger.js';

dotenv.config({ ENV_PATH, override: true });

const require = createRequire(import.meta.url);
const { setTimeout } = require('timers/promises');

async function processAndInsertNewerAssertions(
    blockchainDetails,
    blockchainName,
    highestTokenId,
    tripleStoreRepositories,
    tripleStoreImplementation,
    rpcEndpoints,
) {
    // Validation
    validateBlockchainName(blockchainName);
    validateBlockchainDetails(blockchainDetails);
    validateTokenId(highestTokenId);
    validateTripleStoreRepositories(tripleStoreRepositories);
    validateTripleStoreImplementation(tripleStoreImplementation);

    const provider = await initializeRpc(rpcEndpoints[0]);
    const storageContract = await getContentAssetStorageContract(provider, blockchainDetails);
    let assertionExists = true;
    let newTokenId = highestTokenId;

    /* eslint-disable no-await-in-loop */
    while (assertionExists) {
        // increase the tokenId by 1
        newTokenId += 1;
        logger.info(`Fetching assertion for tokenId: ${newTokenId}`);

        // construct new ual
        const newUal = `did:dkg:${blockchainDetails.ID}/${blockchainDetails.CONTENT_ASSET_STORAGE_CONTRACT_ADDRESS}/${newTokenId}`;

        const assertionIds = await storageContract.getAssertionIds(newTokenId);
        if (assertionIds.length === 0) {
            logger.info(`You have processed all assertions on ${blockchainName}. Skipping...`);
            assertionExists = false;
            break;
        }

        // Get the latest assertionId
        const assertionId = assertionIds[assertionIds.length - 1];

        const assertion = await getAssertionFromV6TripleStore(
            tripleStoreRepositories,
            tripleStoreImplementation,
            newTokenId,
            {
                assertionId,
                ual: newUal,
            },
        );

        if (!assertion.success) {
            logger.error(
                `Assertion with assertionId ${assertionId} exists in V6 triple store but could not be fetched. Retrying...`,
            );
            newTokenId -= 1;
            continue;
        }

        logger.info(
            `Found assertion with assertionId ${assertionId} for tokenId ${newTokenId} in V6 triple store`,
        );

        const { successfullyProcessed, assertionsToCheck } =
            await insertAssertionsIntoV8UnifiedRepository([assertion], tripleStoreRepositories);

        if (successfullyProcessed.length === 0) {
            logger.error(
                `Assertion with assertionId ${assertionId} could not be inserted. Retrying...`,
            );
            newTokenId -= 1;
            continue;
        }

        if (assertionsToCheck.length > 0) {
            const { tokenId, ual, privateAssertion } = assertionsToCheck[0];
            const knowledgeAssetUal = `${ual}/1`;
            logger.time(`GETTING KNOWLEDGE COLLECTION NAMED GRAPHS EXIST FOR 1 ASSERTION`);
            // eslint-disable-next-line no-await-in-loop
            const { exists } = await getKnowledgeCollectionNamedGraphsExist(
                tokenId,
                tripleStoreRepositories,
                knowledgeAssetUal,
                privateAssertion,
            );
            logger.timeEnd(`GETTING KNOWLEDGE COLLECTION NAMED GRAPHS EXIST FOR 1 ASSERTION`);

            if (!exists) {
                logger.error(
                    `Assertion with assertionId ${assertionId} was inserted but its KA named graph does not exist. Retrying...`,
                );
                newTokenId -= 1;
                continue;
            }
        }

        logger.info(
            `Successfully inserted public/private assertions into V8 triple store for tokenId: ${newTokenId}`,
        );
    }
}

async function deleteV6TripleStoreRepositories(tripleStoreConfig, tripleStoreImplementation) {
    // Validation
    validateTripleStoreConfig(tripleStoreConfig);
    validateTripleStoreImplementation(tripleStoreImplementation);

    // Delete old repositories
    const oldTripleStoreRepositories =
        tripleStoreConfig.implementation[tripleStoreImplementation].config.repositories;
    for (const repository in oldTripleStoreRepositories) {
        if (repository === DKG_REPOSITORY) {
            continue;
        }

        logger.info(`Deleting repository: ${repository}`);

        let deleted = false;
        while (!deleted) {
            // eslint-disable-next-line no-await-in-loop
            await deleteRepository(
                oldTripleStoreRepositories,
                tripleStoreImplementation,
                repository,
            );
            // eslint-disable-next-line no-await-in-loop
            if (
                await repositoryExists(
                    oldTripleStoreRepositories,
                    repository,
                    tripleStoreImplementation,
                )
            ) {
                logger.error(
                    `Something went wrong. Repository ${repository} still exists after deletion. Retrying deletion...`,
                );
            } else {
                deleted = true;
            }
        }
        logger.info(`Repository ${repository} deleted successfully`);
    }
}

async function processAndInsertAssertions(
    v6Assertions,
    tripleStoreRepositories,
    tripleStoreImplementation,
) {
    // Validation
    if (!v6Assertions || !Array.isArray(v6Assertions)) {
        throw new Error(
            `v6Assertions is not defined or it is not an array. V6 assertions: ${v6Assertions}`,
        );
    }
    validateTripleStoreRepositories(tripleStoreRepositories);
    validateTripleStoreImplementation(tripleStoreImplementation);

    const { successfullyProcessed, assertionsToCheck } =
        await insertAssertionsIntoV8UnifiedRepository(v6Assertions, tripleStoreRepositories);

    const promises = [];
    for (const assertion of assertionsToCheck) {
        const { tokenId, ual, privateAssertion } = assertion;
        const knowledgeAssetUal = `${ual}/1`;

        promises.push(
            getKnowledgeCollectionNamedGraphsExist(
                tokenId,
                tripleStoreRepositories,
                knowledgeAssetUal,
                privateAssertion,
            ),
        );
    }

    logger.time(
        `GETTING KNOWLEDGE COLLECTION NAMED GRAPHS EXIST FOR ${promises.length} ASSERTIONS`,
    );
    const results = await Promise.all(promises);
    logger.timeEnd(
        `GETTING KNOWLEDGE COLLECTION NAMED GRAPHS EXIST FOR ${promises.length} ASSERTIONS`,
    );

    const successfulInserts = results
        .filter((result) => result.exists)
        .map((result) => result.tokenId);

    successfullyProcessed.push(...successfulInserts);
    logger.info(`Successfully processed assertions: ${successfullyProcessed.length}`);

    return successfullyProcessed;
}

async function getAssertionsInBatch(
    batchKeys,
    batchData,
    tripleStoreRepositories,
    tripleStoreImplementation,
) {
    // Validation
    if (!batchKeys || !Array.isArray(batchKeys)) {
        throw new Error(
            `Batch keys is not defined or it is not an array. Batch keys: ${batchKeys}`,
        );
    }
    validateBatchData(batchData);
    validateTripleStoreRepositories(tripleStoreRepositories);
    validateTripleStoreImplementation(tripleStoreImplementation);

    const batchPromises = [];
    for (const tokenId of batchKeys) {
        batchPromises.push(
            getAssertionFromV6TripleStore(
                tripleStoreRepositories,
                tripleStoreImplementation,
                tokenId,
                batchData[tokenId],
            ),
        );
    }

    const batchResults = await Promise.all(batchPromises);

    // Get all successful assertions
    const v6Assertions = batchResults.filter((result) => result.success);

    return v6Assertions;
}

async function main() {
    // REMOTE
    ensureMigrationProgressFileExists();

    // Make sure data/data-migration directory exists (for csv files)
    ensureDirectoryExists(DATA_MIGRATION_DIR);
    // REMOTE END

    // initialize node config
    const config = initializeConfig();

    // Initialize blockchain config
    const blockchainConfig = config.modules.blockchain;
    if (!blockchainConfig || !blockchainConfig.implementation) {
        throw new Error('Invalid configuration for blockchain.');
    }

    logger.info('TRIPLE STORE INITIALIZATION START');

    // Initialize triple store config
    const tripleStoreConfig = config.modules.tripleStore;
    if (!tripleStoreConfig || !tripleStoreConfig.implementation) {
        throw new Error('Invalid configuration for triple store.');
    }

    const tripleStoreData = getTripleStoreData(tripleStoreConfig);
    // eslint-disable-next-line prefer-destructuring
    const tripleStoreImplementation = tripleStoreData.tripleStoreImplementation;
    // eslint-disable-next-line prefer-destructuring
    let tripleStoreRepositories = tripleStoreData.tripleStoreRepositories;

    // Initialize repositories
    tripleStoreRepositories = initializeRepositories(
        tripleStoreRepositories,
        tripleStoreImplementation,
    );

    // Initialize contexts
    tripleStoreRepositories = initializeContexts(tripleStoreRepositories);

    // Ensure connections
    await ensureConnections(tripleStoreRepositories, tripleStoreImplementation);

    // TODO: Is it necessary? Any other migration doing it?
    await createDkgRepository(tripleStoreRepositories, DKG_REPOSITORY, tripleStoreImplementation);

    // Iterate through all chains
    for (const blockchain in blockchainConfig.implementation) {
        logger.time(`CSV PROCESSING TIME FOR ${blockchain}`);
        let processed = 0;
        const blockchainImplementation = blockchainConfig.implementation[blockchain];
        if (!blockchainImplementation.enabled) {
            logger.info(`Blockchain ${blockchain} is not enabled. Skipping...`);
            continue;
        }
        const rpcEndpoints = blockchainImplementation?.config?.rpcEndpoints;
        if (!Array.isArray(rpcEndpoints) || rpcEndpoints.length === 0) {
            logger.error(`RPC endpoints are not defined for blockchain ${blockchain}. Skipping...`);
            continue;
        }

        let blockchainName;
        let blockchainDetails;
        for (const [, details] of Object.entries(BLOCKCHAINS)) {
            if (details.ID === blockchain && details.ENV === process.env.NODE_ENV) {
                blockchainName = details.NAME;
                blockchainDetails = details;
                break;
            }
        }

        if (!blockchainName) {
            logger.info(`Blockchain ${blockchain} not found. Skipping...`);
            continue;
        }

        // REMOTE
        // Check if blockchain csv exists and if it doesn't copy the csv to it
        const filePath = path.join(DATA_MIGRATION_DIR, `${blockchainName}.csv`);
        if (!fs.existsSync(filePath)) {
            logger.info(
                `CSV file for blockchain ${blockchainName} does not exist in ${DATA_MIGRATION_DIR}. Creating it...`,
            );
            const __dirname = path.dirname(new URL(import.meta.url).pathname);
            const csvFilePath = path.join(__dirname, `${blockchainName}.csv`);
            fs.copyFileSync(csvFilePath, filePath);

            if (!fs.existsSync(filePath)) {
                logger.error(
                    `CSV file for blockchain ${blockchainName} could not be created. Continuing to the next blockchain...`,
                );
                continue;
            }
        }
        // REMOTE END
        logger.info('GET CSV DATA');

        // // LOCAL TESTING
        // const __dirname = path.dirname(new URL(import.meta.url).pathname);
        // const filePath = path.join(__dirname, `${blockchainName}.csv`);
        // // LOCAL TESTING END

        const csvDataStream = getCsvDataStream(filePath, BATCH_SIZE);

        const highestTokenId = await getHighestTokenId(filePath);
        logger.info(`Total amount of tokenIds: ${highestTokenId}`);

        const tokenIdsToProcessCount = await getTokenIdsToProcessCount(filePath);
        logger.info(`Amount of tokenIds left to process: ${tokenIdsToProcessCount}`);

        // Iterate through the csv data and push to triple store until all data is processed
        while (true) {
            logger.time('GETTING THE NEW CSV DATA BATCH');
            const next = await csvDataStream.next();
            logger.timeEnd('GETTING THE NEW CSV DATA BATCH');

            if (next.done) break; // No more unprocessed records

            const batchData = next.value;
            const batchKeys = Object.keys(batchData);

            try {
                logger.time('FETCHING V6 ASSERTIONS');
                const v6Assertions = await getAssertionsInBatch(
                    batchKeys,
                    batchData,
                    tripleStoreRepositories,
                    tripleStoreImplementation,
                );
                logger.timeEnd('FETCHING V6 ASSERTIONS');

                if (v6Assertions.length === 0) {
                    throw new Error(
                        `Something went wrong. Could not get any V6 assertions in batch ${batchKeys}`,
                    );
                }

                logger.info(`Number of V6 assertions to process: ${v6Assertions.length}`);

                const successfullyProcessed = await processAndInsertAssertions(
                    v6Assertions,
                    tripleStoreRepositories,
                    tripleStoreImplementation,
                );

                if (successfullyProcessed.length === 0) {
                    throw new Error(
                        `Could not insert any assertions out of ${v6Assertions.length}`,
                    );
                }

                logger.info(
                    `Successfully processed/inserted assertions: ${successfullyProcessed.length}`,
                );

                // mark data as processed in csv file
                await updateCsvFile(filePath, successfullyProcessed);

                processed += successfullyProcessed.length;
                logger.info(
                    `[PROGRESS] for ${blockchainName}: ${(
                        (processed / tokenIdsToProcessCount) *
                        100
                    ).toFixed(2)}%. Total processed: ${processed}/${tokenIdsToProcessCount}`,
                );
            } catch (error) {
                logger.error(`Error processing batch: ${error}. Pausing for 5 second...`);
                await setTimeout(5000);
            }
        }

        logger.timeEnd(`CSV PROCESSING TIME FOR ${blockchain}`);

        logger.time('BLOCKCHAIN ASSERRTION GET AND TRIPLE STORE INSERT');
        // If newer (unprocessed) assertions exist on-chain, fetch them and insert them into the V8 triple store repository
        // eslint-disable-next-line no-await-in-loop
        await processAndInsertNewerAssertions(
            blockchainDetails,
            blockchainName,
            highestTokenId,
            tripleStoreRepositories,
            tripleStoreImplementation,
            rpcEndpoints,
        );
        logger.timeEnd('BLOCKCHAIN ASSERRTION GET AND TRIPLE STORE INSERT');
    }

    logger.time('DELETE V6 TRIPLE STORE REPOSITORIES');
    await deleteV6TripleStoreRepositories(tripleStoreConfig, tripleStoreImplementation);
    logger.timeEnd('DELETE V6 TRIPLE STORE REPOSITORIES');

    // REMOTE
    markMigrationAsSuccessfull();
    // REMOTE END
}

main();
