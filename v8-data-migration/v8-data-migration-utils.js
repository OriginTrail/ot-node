import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify';
import { parse as csvParse } from 'csv-parse';
import readLastLines from 'read-last-lines';
import { NODERC_CONFIG_PATH, MIGRATION_PROGRESS_FILE } from './constants.js';
import { validateSuccessfulInserts, validateConfig } from './validation.js';
import logger from './logger.js';

export function initializeConfig() {
    const configPath = path.resolve(NODERC_CONFIG_PATH);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    validateConfig(config);
    return config;
}

export async function getHighestTokenId(csvFilePath) {
    try {
        const lastLine = await readLastLines.read(csvFilePath, 1); // Read the last line
        const trimmedLine = lastLine.trim(); // Remove trailing newline, if any

        // If the last line is empty, read the second-to-last line
        if (!trimmedLine) {
            const secondLastLine = await readLastLines.read(csvFilePath, 2);
            const lines = secondLastLine.split('\n').filter((line) => line.trim() !== '');
            return parseInt(lines[lines.length - 1].split(',')[0], 10); // Token ID from last valid line
        }

        return parseInt(trimmedLine.split(',')[0], 10); // Token ID from last line
    } catch (error) {
        throw new Error('Error reading file last line:', error);
    }
}

export async function* getCsvDataStream(filePath, batchSize) {
    logger.info(`CSV FILE PATH: ${filePath}`);

    // Keep yielding batches until all records are processed
    while (true) {
        const currentBatch = {};
        let count = 0;

        // Read file again for unprocessed records
        const batchParser = csvParse();
        const batchStream = fs.createReadStream(filePath);

        // eslint-disable-next-line no-await-in-loop
        for await (const row of batchStream.pipe(batchParser)) {
            const [tokenId, ual, assertionId, processed = 'false'] = row;
            if (processed === 'false') {
                currentBatch[tokenId] = { ual, assertionId, processed };
                count += 1;

                if (count === batchSize) {
                    break; // Exit after collecting one batch
                }
            }
        }

        // If no unprocessed records found, we're done
        if (count === 0) {
            break;
        }

        yield currentBatch;
    }
}

export async function updateCsvFile(filePath, successfulInserts) {
    // Validation
    validateSuccessfulInserts(successfulInserts);

    const tempPath = `${filePath}.tmp`;

    const readStream = fs.createReadStream(filePath);
    const parser = csvParse();

    let processedCount = 0;
    const remainingInserts = new Set(successfulInserts);
    const records = [];

    // Update processed column
    try {
        await new Promise((resolve, reject) => {
            readStream
                .pipe(parser)
                .on('data', (record) => {
                    const tokenId = record[0];
                    const modifiedRecord = [...record];
                    if (remainingInserts.has(tokenId)) {
                        modifiedRecord[3] = 'true'; // Modify the copy
                        processedCount += 1;
                        remainingInserts.delete(tokenId);
                    }
                    records.push(modifiedRecord);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        // Write updated records to file
        const updatedCsvData = stringify(records, { header: false });
        await fs.promises.writeFile(tempPath, updatedCsvData);

        // Replace original file with updated one
        await fs.promises.rename(tempPath, filePath);

        logger.info(`CSV file updated successfully with ${processedCount} successful inserts.`);
        if (remainingInserts.size > 0) {
            logger.warn(
                `Could not find ${
                    remainingInserts.size
                } successfully inserted tokenIds in the CSV file. TokenIds: ${[
                    ...remainingInserts,
                ]}`,
            );
        }
    } catch (error) {
        // Clean up temp file if something goes wrong
        if (fs.existsSync(tempPath)) {
            await fs.promises.unlink(tempPath);
        }
        throw error;
    }
}

export function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Created directory: ${dirPath}`);
    }
}

export function ensureMigrationProgressFileExists() {
    if (!fs.existsSync(MIGRATION_PROGRESS_FILE)) {
        fs.writeFileSync(MIGRATION_PROGRESS_FILE, '');
        logger.info(`Created migration progress file: ${MIGRATION_PROGRESS_FILE}`);
        if (!fs.existsSync(MIGRATION_PROGRESS_FILE)) {
            throw new Error(
                `Something went wrong. Progress file: ${MIGRATION_PROGRESS_FILE} does not exist after creation.`,
            );
        }
    } else {
        logger.info(`Migration progress file already exists: ${MIGRATION_PROGRESS_FILE}.`);
        logger.info('Checking if migration is already successful...');
        const fileContent = fs.readFileSync(MIGRATION_PROGRESS_FILE, 'utf8');
        if (fileContent === 'MIGRATED') {
            logger.info('Migration is already successful. Exiting...');
            process.exit(0);
        }
    }
}

export function markMigrationAsSuccessfull() {
    // open file
    const file = fs.openSync(MIGRATION_PROGRESS_FILE, 'w');

    // write MIGRATED
    fs.writeSync(file, 'MIGRATED');

    // close file
    fs.closeSync(file);
}

export async function getTokenIdsToProcessCount(filePath) {
    // Read file again for unprocessed records
    const batchParser = csvParse();
    const batchStream = fs.createReadStream(filePath);

    let count = 0;

    // eslint-disable-next-line no-await-in-loop
    for await (const row of batchStream.pipe(batchParser)) {
        const [, , , processed = 'false'] = row;
        if (processed === 'false') {
            count += 1;
        }
    }

    return count;
}
