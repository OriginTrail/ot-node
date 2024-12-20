import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import axios from 'axios';
import { BATCH_SIZE, ENV_PATH, BLOCKCHAINS, DATA_MIGRATION_DIR, DB_URLS } from './constants.js';
import {
    initializeConfig,
    initializeDefaultConfig,
    ensureDirectoryExists,
    ensureMigrationProgressFileExists,
    markMigrationAsSuccessfull,
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
import sqliteDb from './sqlite-utils.js';
import logger from './logger.js';

dotenv.config({ path: ENV_PATH, override: true });

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
            logger.info(
                `You have processed all assertions on ${blockchainName}. Moving to the next blockchain...`,
            );
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

        const { successfullyProcessed, assertionsToCheck } =
            await insertAssertionsIntoV8UnifiedRepository([assertion], tripleStoreRepositories);

        if (successfullyProcessed.length > 0) {
            logger.info(
                `Assertion with assertionId ${assertionId} does not exist in V6 triple store.`,
            );
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

            logger.info(
                `Successfully inserted public/private assertions into V8 triple store for tokenId: ${newTokenId}`,
            );
        }

        const inserted = await sqliteDb.insertAssertion(
            blockchainName,
            newTokenId,
            newUal,
            assertionId,
        );
        if (!inserted) {
            logger.error(
                `Assertion with assertionId ${assertionId} could not be inserted. Retrying...`,
            );
            newTokenId -= 1;
            continue;
        }
        logger.info(
            `Assertion with tokenId ${newTokenId} inserted into db and marked as processed.`,
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

    logger.info(
        `Number of assertions that do not exist in V6 triple store: ${successfullyProcessed.length}`,
    );

    logger.info(`Verifying V8 triple store insertions for ${assertionsToCheck.length} assertions`);

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

    logger.info(`Number of successfully inserted assertions: ${successfulInserts.length}`);

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
    ensureMigrationProgressFileExists();

    // Make sure data/data-migration directory exists
    ensureDirectoryExists(DATA_MIGRATION_DIR);

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

    // Check if db exists and if it doesn't download it to the relevant directory
    const dbFilePath = path.join(DATA_MIGRATION_DIR, `${process.env.NODE_ENV}.db`);
    if (!fs.existsSync(dbFilePath)) {
        logger.info(
            `DB file for ${process.env.NODE_ENV} does not exist in ${DATA_MIGRATION_DIR}. Downloading it...`,
        );
        // Fetch the db file from the remote server
        logger.info(
            `Fetching ${process.env.NODE_ENV}.db file from ${
                DB_URLS[process.env.NODE_ENV]
            }. This may take a while...`,
        );
        logger.time(`Database file downloading time`);
        const writer = fs.createWriteStream(dbFilePath);
        const response = await axios({
            url: DB_URLS[process.env.NODE_ENV],
            method: 'GET',
            responseType: 'stream',
        });

        // Pipe the response stream to the file
        response.data.pipe(writer);
        // Wait for the file to finish downloading
        await new Promise((resolve, reject) => {
            let downloadComplete = false;

            response.data.on('end', () => {
                downloadComplete = true;
            });

            writer.on('finish', resolve);
            writer.on('error', (err) => reject(new Error(`Write stream error: ${err.message}`)));
            response.data.on('error', (err) =>
                reject(new Error(`Download stream error: ${err.message}`)),
            );
            response.data.on('close', () => {
                if (!downloadComplete) {
                    reject(new Error('Download stream closed before completing'));
                }
            });
        });
        logger.timeEnd(`Database file downloading time`);

        if (!fs.existsSync(dbFilePath)) {
            throw new Error(`DB file for ${process.env.NODE_ENV} could not be created.`);
        }
    }

    // Initialize SQLite database once before processing blockchains
    logger.info('Initializing SQLite database');
    await sqliteDb.initialize();

    try {
        // Iterate through all chains
        for (const blockchain in blockchainConfig.implementation) {
            logger.time(`PROCESSING TIME FOR ${blockchain}`);
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

            const tableExists = await sqliteDb.getTableExists(blockchainName);

            if (!tableExists) {
                throw new Error(
                    `Required table "${blockchainName}" does not exist in the database`,
                );
            }

            const highestTokenId = await sqliteDb.getHighestTokenId(blockchainName);
            if (!highestTokenId) {
                throw new Error(
                    `Something went wrong. Could not fetch highest tokenId for ${blockchainName}.`,
                );
            }
            logger.info(`Total amount of tokenIds: ${highestTokenId}`);

            const tokenIdsToProcessCount = await sqliteDb.getUnprocessedCount(blockchainName);
            logger.info(`Amount of tokenIds left to process: ${tokenIdsToProcessCount}`);

            // Process tokens in batches
            while (true) {
                logger.time('BATCH PROCESSING TIME');

                const batchData = await sqliteDb.getBatchOfUnprocessedTokenIds(
                    blockchainName,
                    BATCH_SIZE,
                );
                const batchKeys = Object.keys(batchData);

                if (batchKeys.length === 0) {
                    logger.info('No more unprocessed tokenIds found. Moving on...');
                    logger.timeEnd('BATCH PROCESSING TIME');
                    break;
                }

                logger.info(`Processing batch: ${batchKeys}`);

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
                        `Successfully processed/inserted assertions: ${successfullyProcessed.length}. Marking rows as processed in db...`,
                    );

                    await sqliteDb.markRowsAsProcessed(blockchainName, successfullyProcessed);
                    processed += successfullyProcessed.length;

                    logger.info(
                        `[PROGRESS] for ${blockchainName}: ${(
                            (processed / tokenIdsToProcessCount) *
                            100
                        ).toFixed(2)}%. Total processed: ${processed}/${tokenIdsToProcessCount}`,
                    );
                } catch (error) {
                    logger.error(`Error processing batch: ${error}. Pausing for 5 seconds...`);
                    await setTimeout(5000);
                }
            }

            logger.timeEnd(`PROCESSING TIME FOR ${blockchain}`);

            logger.time(`PROCESS AND INSERT NEWER ASSERTIONS FOR ${blockchainName}`);
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
            logger.timeEnd(`PROCESS AND INSERT NEWER ASSERTIONS FOR ${blockchainName}`);
        }
    } finally {
        // Close database connection after all blockchains are processed
        await sqliteDb.close();
    }

    markMigrationAsSuccessfull();
}

main();
