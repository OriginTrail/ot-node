import path from 'path';
import { mkdir, writeFile, readFile, unlink, stat, readdir, access, rm } from 'fs/promises';
import appRootPath from 'app-root-path';

const MIGRATION_FOLDER_NAME = 'migrations';

const ARCHIVE_FOLDER_NAME = 'archive';

class FileService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    getFileExtension(filePath) {
        return path.extname(filePath).toLowerCase();
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
        this.logger.debug(`Reading folder at path: ${dirPath}`);
        try {
            return readdir(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw Error(`Folder not found at path: ${dirPath}`);
            }
            throw error;
        }
    }

    async readFirstFileFromDirectory(documentFolderPath, convertToJSON = true) {
        let files;
        try {
            files = await this.readDirectory(documentFolderPath);
        } catch (error) {
            return null;
        }
        if (files.length > 0) {
            // if there are files, read the content of the first file
            return this._readFile(`${documentFolderPath}/${files[0]}`, convertToJSON);
        }

        return null;
    }

    async stat(filePath) {
        return stat(filePath);
    }

    /**
     * Loads JSON data from file
     * @returns {Promise<JSON object>}
     * @private
     */
    loadJsonFromFile(filePath) {
        return this._readFile(filePath, true);
    }

    async fileExists(filePath) {
        try {
            await stat(filePath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    async directoryExists(directoryPath) {
        try {
            await access(directoryPath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    async _readFile(filePath, convertToJSON = false) {
        this.logger.debug(
            `Reading file at path: ${filePath}, converting to json: ${convertToJSON}`,
        );
        try {
            const data = await readFile(filePath, 'utf-8');
            if (convertToJSON) {
                try {
                    return JSON.parse(data);
                } catch (error) {
                    throw Error(`Error parsing JSON data from file: ${filePath}`);
                }
            } else {
                return data;
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw Error(`File not found at path: ${filePath}`);
            }
            throw error;
        }
    }

    async removeFile(filePath) {
        try {
            this.logger.debug(`Attempting to remove file at path: ${filePath}`);
            await unlink(filePath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.debug(`File not found at path: ${filePath}`);
                return false;
            }
            throw error;
        }
    }

    async removeFolder(folderPath) {
        try {
            this.logger.debug(`Attempting to remove folder at path: ${folderPath}`);
            await rm(folderPath, { recursive: true });
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.debug(`Folder not found at path: ${folderPath}`);
                return false;
            }
            throw error;
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

    getPendingStorageFileName(assertionId) {
        return assertionId;
    }

    getPendingStorageCachePath(repository) {
        return path.join(this.getDataFolderPath(), 'pending_storage_cache', repository);
    }

    getPendingStorageAssetFolderPath(repository, blockchain, contract, tokenId) {
        return path.join(
            this.getPendingStorageCachePath(repository),
            `${blockchain.toLowerCase()}:${contract.toLowerCase()}:${tokenId}`,
        );
    }

    getPendingStorageDocumentPath(repository, blockchain, contract, tokenId, assertionId) {
        return path.join(
            this.getPendingStorageAssetFolderPath(repository, blockchain, contract, tokenId),
            this.getPendingStorageFileName(assertionId),
        );
    }

    getArchiveFolderPath(subFolder) {
        return path.join(this.getDataFolderPath(), ARCHIVE_FOLDER_NAME, subFolder);
    }
}

export default FileService;
