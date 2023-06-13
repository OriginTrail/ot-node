import { glob } from 'glob';
import path from 'path';
import { mkdir, writeFile, readFile, unlink, stat, readdir } from 'fs/promises';
import appRootPath from 'app-root-path';

const MIGRATION_FOLDER_NAME = 'migrations';

class FileService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    getFileExtension(fileName) {
        return path.extname(fileName).toLowerCase();
    }

    /**
     * Write contents to file
     * @param directory
     * @param filename
     * @param data
     * @returns {Promise}
     */
    async writeContentsToFile(directory, filename, data, log = true) {
        if (log) {
            this.logger.debug(`Saving file with name: ${filename} in directory: ${directory}`);
        }
        await mkdir(directory, { recursive: true });
        const fullpath = path.join(directory, filename);
        await writeFile(fullpath, data);
        return fullpath;
    }

    readFileOnPath(filePath) {
        return this._readFile(filePath, false);
    }

    async readDirectory(dirPath) {
        return readdir(dirPath);
    }

    async stat(filePath) {
        return stat(filePath);
    }

    /**
     * Loads JSON data from file
     * @returns {Promise<JSON object>}
     * @private
     */
    loadJsonFromFile(pattern) {
        return this._readFile(pattern, true);
    }

    async fileExists(pattern) {
        return glob(pattern).then(
            (result) => result.length > 0,
            (error) => {
                this.logger.error(`An error occurred: ${error}`);
                return false;
            },
        );
    }

    async _readFile(pattern, convertToJSON = false) {
        this.logger.debug(
            `Reading file matching pattern: ${pattern}, converting to json: ${convertToJSON}`,
        );
        try {
            const filenames = await glob(pattern);

            if (filenames.length === 0) {
                throw new Error(`No files found for pattern: ${pattern}`);
            }

            const data = await readFile(filenames[0]);
            return convertToJSON ? JSON.parse(data) : data.toString();
        } catch (e) {
            throw Error(`Error reading file for pattern: ${pattern}`);
        }
    }

    async removeFiles(pattern) {
        this.logger.trace(`Removing file(s) matching pattern: ${pattern}`);
        try {
            const filenames = await glob(pattern);

            await Promise.all(filenames.map((filename) => unlink(filename)));

            if (filenames.length > 0) {
                return true;
            }

            this.logger.debug(`No files found for pattern: ${pattern}`);
            return false;
        } catch (e) {
            throw new Error(`Error removing file(s) for pattern: ${pattern}`);
        }
    }

    getDataFolderPath() {
        if (process.env.NODE_ENV === 'testnet' || process.env.NODE_ENV === 'mainnet') {
            return path.join(appRootPath.path, '..', this.config.appDataPath);
        }
        return path.join(appRootPath.path, this.config.appDataPath);
    }

    getUpdateFilePath() {
        return path.join(this.getDataFolderPath(), 'UPDATED');
    }

    getMigrationFolderPath() {
        return path.join(this.getDataFolderPath(), MIGRATION_FOLDER_NAME);
    }

    getOperationIdCachePath() {
        return path.join(this.getDataFolderPath(), 'operation_id_cache');
    }

    getOperationIdDocumentPath(operationId) {
        return path.join(this.getOperationIdCachePath(), operationId);
    }

    getPendingStorageFileName(blockchain, contract, tokenId, stateId) {
        return `${blockchain.toLowerCase()}:${contract.toLowerCase()}:${tokenId}:${stateId}`;
    }

    getPendingStorageFileNamePattern(blockchain, contract, tokenId) {
        return `${blockchain.toLowerCase()}:${contract.toLowerCase()}:${tokenId}:*`;
    }

    getPendingStorageCachePath(repository) {
        return path.join(this.getDataFolderPath(), 'pending_storage_cache', repository);
    }

    getPendingStorageDocumentPathPattern(repository, blockchain, contract, tokenId) {
        return path.join(
            this.getPendingStorageCachePath(repository),
            this.getPendingStorageFileNamePattern(blockchain, contract, tokenId),
        );
    }

    getPendingStorageDocumentPath(repository, blockchain, contract, tokenId, stateId) {
        return path.join(
            this.getPendingStorageCachePath(repository),
            this.getPendingStorageFileName(blockchain, contract, tokenId, stateId),
        );
    }
}

export default FileService;
