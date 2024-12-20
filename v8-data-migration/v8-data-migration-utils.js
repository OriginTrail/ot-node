import fs from 'fs';
import path from 'path';
import { NODERC_CONFIG_PATH, MIGRATION_PROGRESS_FILE, DEFAULT_CONFIG_PATH } from './constants.js';
import { validateConfig } from './validation.js';
import logger from './logger.js';

export function initializeConfig() {
    const configPath = path.resolve(NODERC_CONFIG_PATH);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    validateConfig(config);
    return config;
}

export function initializeDefaultConfig() {
    const configPath = path.resolve(DEFAULT_CONFIG_PATH);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    validateConfig(config);
    return config;
}

export function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info(`Created directory: ${dirPath}`);

        if (!fs.existsSync(dirPath)) {
            throw new Error(
                `Something went wrong. Directory: ${dirPath} does not exist after creation.`,
            );
        }
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
