import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import axios from 'axios';
import {
    BATCH_SIZE,
    ENV_PATH,
    BLOCKCHAINS,
    DATA_MIGRATION_DIR,
    NEUROWEB_TESTNET_CSV_URL,
} from './constants.js';
import {
    updateCsvFile,
    initializeConfig,
    initializeDefaultConfig,
    getCsvDataStream,
    getHighestTokenId,
    ensureDirectoryExists,
    ensureMigrationProgressFileExists,
    markMigrationAsSuccessfull,
    getTokenIdsToProcessCount,
} from './v8-data-migration-utils.js';
import {
    getAssertionFromV6TripleStore,
    insertAssertionsIntoV8UnifiedRepository,
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

    // initialize noderc config
    const config = initializeConfig();

    // initialize default config
    const defaultConfig = initializeDefaultConfig();

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

    if (Object.keys(tripleStoreRepositories).length !== 3) {
        throw new Error(
            `Triple store repositories are not initialized correctly. Expected 3 repositories, got: ${
                Object.keys(tripleStoreRepositories).length
            }`,
        );
    }

    // Initialize repositories
    tripleStoreRepositories = initializeRepositories(
        tripleStoreRepositories,
        tripleStoreImplementation,
    );

    // Initialize contexts
    tripleStoreRepositories = initializeContexts(tripleStoreRepositories);

    // Ensure connections
    await ensureConnections(tripleStoreRepositories, tripleStoreImplementation);

    // Iterate through all chains
    for (const blockchain in blockchainConfig.implementation) {
        logger.time(`CSV PROCESSING TIME FOR ${blockchain}`);
        let processed = 0;
        const blockchainImplementation = blockchainConfig.implementation[blockchain];
        if (!blockchainImplementation.enabled) {
            logger.info(`Blockchain ${blockchain} is not enabled. Skipping...`);
            continue;
        }
        const rpcEndpoints = blockchainImplementation?.config?.rpcEndpoints
            ? blockchainImplementation.config.rpcEndpoints
            : defaultConfig[process.env.NODE_ENV].modules.blockchain.implementation[blockchain]
                  .config.rpcEndpoints;
        if (!Array.isArray(rpcEndpoints) || rpcEndpoints.length === 0) {
            throw new Error(`RPC endpoints are not defined for blockchain ${blockchain}.`);
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
            throw new Error(
                `Blockchain ${blockchain} not found. Make sure you have the correct blockchain ID and correct NODE_ENV in .env file.`,
            );
        }

        // REMOTE
        // Check if blockchain csv exists and if it doesn't copy the csv to it
        const __dirname = path.dirname(new URL(import.meta.url).pathname);
        const csvFilePath = path.join(__dirname, `${blockchainName}.csv`);
        const csvMigrationDirFilePath = path.join(DATA_MIGRATION_DIR, `${blockchainName}.csv`);
        if (!fs.existsSync(csvMigrationDirFilePath)) {
            logger.info(
                `CSV file for blockchain ${blockchainName} does not exist in ${DATA_MIGRATION_DIR}. Creating it...`,
            );
            if (blockchainName === BLOCKCHAINS.NEUROWEB_TESTNET.NAME) {
                // Fetch the csv file from the remote server
                logger.info(
                    `Fetching ${blockchainName}.csv file from ${NEUROWEB_TESTNET_CSV_URL}. This may take a while...`,
                );
                const writer = fs.createWriteStream(csvFilePath);
                const response = await axios({
                    url: NEUROWEB_TESTNET_CSV_URL,
                    method: 'GET',
                    responseType: 'stream',
                });

                // Pipe the response stream to the file
                response.data.pipe(writer);
                logger.time(`CSV FILE DOWNLOADED`);
                // Wait for the file to finish downloading
                await new Promise((resolve, reject) => {
                    let downloadComplete = false;

                    response.data.on('end', () => {
                        downloadComplete = true;
                    });

                    writer.on('finish', resolve);
                    writer.on('error', (err) =>
                        reject(new Error(`Write stream error: ${err.message}`)),
                    );
                    response.data.on('error', (err) =>
                        reject(new Error(`Download stream error: ${err.message}`)),
                    );
                    response.data.on('close', () => {
                        if (!downloadComplete) {
                            reject(new Error('Download stream closed before completing'));
                        }
                    });
                });
                logger.timeEnd(`CSV FILE DOWNLOADED`);
            }

            // Copy the csv file to the data/data-migration directory
            fs.copyFileSync(csvFilePath, csvMigrationDirFilePath);

            if (!fs.existsSync(csvMigrationDirFilePath)) {
                throw new Error(`CSV file for blockchain ${blockchainName} could not be created.`);
            }
        }
        // REMOTE END
        logger.info('GET CSV DATA');

        // // LOCAL TESTING
        // const __dirname = path.dirname(new URL(import.meta.url).pathname);
        // const csvMigrationDirFilePath = path.join(__dirname, `${blockchainName}.csv`);
        // // LOCAL TESTING END

        const csvDataStream = getCsvDataStream(csvMigrationDirFilePath, BATCH_SIZE);

        const highestTokenId = await getHighestTokenId(csvMigrationDirFilePath);
        logger.info(`Total amount of tokenIds: ${highestTokenId}`);

        const tokenIdsToProcessCount = await getTokenIdsToProcessCount(csvMigrationDirFilePath);
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
                await updateCsvFile(csvMigrationDirFilePath, successfullyProcessed);

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

    // REMOTE
    markMigrationAsSuccessfull();
    // REMOTE END
}

main();
