import path from 'path';
import { mkdir, writeFile, readFile, unlink, stat, readdir, rm, appendFile } from 'fs/promises';
import appRootPath from 'app-root-path';

const ARCHIVE_FOLDER_NAME = 'archive';
const MIGRATION_FOLDER_NAME = 'migrations';

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
            this.logger.debug(`Saving file with name: ${filename} in the directory: ${directory}`);
        }
        await mkdir(directory, { recursive: true });
        const fullpath = path.join(directory, filename);
        await writeFile(fullpath, data);
        return fullpath;
    }

    async appendContentsToFile(directory, filename, data, log = true) {
        if (log) {
            this.logger.debug(`Saving file with name: ${filename} in the directory: ${directory}`);
        }
        await mkdir(directory, { recursive: true });
        const fullPath = path.join(directory, filename);

        await appendFile(fullPath, data);

        return fullPath;
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

    async stat(filePath) {
        return stat(filePath);
    }

    async pathExists(fileOrDirPath) {
        try {
            await stat(fileOrDirPath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    async readFile(filePath, convertToJSON = false) {
        this.logger.debug(`Reading file: ${filePath}, converting to json: ${convertToJSON}`);
        try {
            const data = await readFile(filePath);
            return convertToJSON ? JSON.parse(data) : data.toString();
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw Error(`File not found at path: ${filePath}`);
            }
            throw error;
        }
    }

    async removeFile(filePath) {
        this.logger.trace(`Removing file at path: ${filePath}`);

        try {
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
        this.logger.debug(`Removing folder at path: ${folderPath}`);
        try {
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
        if (
            process.env.NODE_ENV === 'testnet' ||
            process.env.NODE_ENV === 'mainnet' ||
            process.env.NODE_ENV === 'devnet'
        ) {
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

    getPendingStorageCachePath(repository) {
        return path.join(this.getDataFolderPath(), 'pending_storage_cache', repository);
    }

    getPendingStorageFolderPath(repository, blockchain, contract, tokenId) {
        return path.join(
            this.getPendingStorageCachePath(repository),
            `${blockchain.toLowerCase()}:${contract.toLowerCase()}:${tokenId}`,
        );
    }

    getSignatureStorageCachePath(operationId) {
        return path.join(this.getDataFolderPath(), 'signature_storage_cache', operationId);
    }

    getSignatureStorageFolderPath(blockchain, operationId) {
        return path.join(
            this.getSignatureStorageCachePath(blockchain, operationId),
            `${blockchain.toLowerCase()}:${operationId}`,
        );
    }

    async getSignatureStorageFilePath(blockchain, operationId) {
        const getSignatureStorageCachePath = this.getPendingStorageFolderPath(operationId);

        return path.join(
            getSignatureStorageCachePath,
            `${blockchain.toLowerCase()}:${operationId}`,
        );
    }

    async getPendingStorageLatestDocument(repository, blockchain, contract, tokenId) {
        const pendingStorageFolder = this.getPendingStorageFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );

        let latestFile;
        let latestMtime = 0;
        try {
            const files = await readdir(pendingStorageFolder);

            for (const file of files) {
                const filePath = path.join(pendingStorageFolder, file);
                // eslint-disable-next-line no-await-in-loop
                const stats = await stat(filePath);

                if (stats.mtimeMs > latestMtime) {
                    latestFile = file;
                    latestMtime = stats.mtimeMs;
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.debug(`Folder not found at path: ${pendingStorageFolder}`);
                return false;
            }
            throw error;
        }

        return latestFile ?? false;
    }

    async getPendingStorageDocumentPath(repository, blockchain, contract, tokenId, assertionId) {
        const pendingStorageFolder = this.getPendingStorageFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );

        return path.join(pendingStorageFolder, assertionId);
    }

    getArchiveFolderPath(subFolder) {
        return path.join(this.getDataFolderPath(), ARCHIVE_FOLDER_NAME, subFolder);
    }

    getParentDirectory(filePath) {
        return path.dirname(filePath);
    }
}

export default FileService;
