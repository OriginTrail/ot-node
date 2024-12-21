import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { DATA_MIGRATION_DIR } from './constants.js';
import logger from './logger.js';

export class SqliteDatabase {
    constructor() {
        this.db = null;
    }

    async initialize() {
        if (this.db) {
            return;
        }

        const dbPath = path.join(DATA_MIGRATION_DIR, `${process.env.NODE_ENV}.db`);

        this.db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });

        if (!this.db) {
            throw new Error('Failed to initialize SQLite database');
        }
    }

    async getTableExists(blockchainName) {
        this._validateConnection();
        this._validateBlockchainName(blockchainName);

        const tableExists = await this.db.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [blockchainName],
        );

        return tableExists;
    }

    async getBatchOfUnprocessedTokenIds(blockchainName, batchSize) {
        this._validateConnection();
        this._validateBlockchainName(blockchainName);

        const rows = await this.db.all(
            `
            SELECT token_id, ual, assertion_id
            FROM ${blockchainName}
            WHERE processed = 0
            LIMIT ?
        `,
            batchSize,
        );

        const batchData = {};
        rows.forEach((row) => {
            batchData[row.token_id] = {
                ual: row.ual,
                assertionId: row.assertion_id,
                processed: 'false',
            };
        });

        return batchData;
    }

    async markRowsAsProcessed(blockchainName, tokenIds) {
        this._validateConnection();
        this._validateBlockchainName(blockchainName);

        const placeholders = tokenIds.map(() => '?').join(',');
        await this.db.run(
            `
            UPDATE ${blockchainName}
            SET processed = 1 
            WHERE token_id IN (${placeholders})
        `,
            tokenIds,
        );
    }

    async getHighestTokenId(blockchainName) {
        this._validateConnection();
        this._validateBlockchainName(blockchainName);

        const result = await this.db.get(`SELECT MAX(token_id) as max_id FROM ${blockchainName}`);
        return result.max_id;
    }

    async getUnprocessedCount(blockchainName) {
        this._validateConnection();
        this._validateBlockchainName(blockchainName);

        const result = await this.db.get(`
            SELECT COUNT(*) as count 
            FROM ${blockchainName} 
            WHERE processed = 0
        `);
        return result.count;
    }

    async insertAssertion(blockchainName, tokenId, ual, assertionId) {
        this._validateConnection();
        this._validateBlockchainName(blockchainName);

        try {
            await this.db.run(
                `INSERT OR IGNORE INTO ${blockchainName} (token_id, ual, assertion_id, processed) VALUES (?, ?, ?, 1)`,
                [tokenId, ual, assertionId],
            );
            return true;
        } catch (error) {
            logger.error(`Error inserting assertion into ${blockchainName} table:`, error.message);
            return false;
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
        }
    }

    _validateConnection() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
    }

    _validateBlockchainName(blockchainName) {
        if (!blockchainName) {
            throw new Error('Blockchain name is required');
        }
    }
}

// Export a single instance
const sqliteDb = new SqliteDatabase();
export default sqliteDb;
