import path from 'path';
import { mkdir, writeFile, readFile, unlink, stat, readdir, rm } from 'fs/promises';
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
            this.logger.debug(
                `Saving the file with the name: ${filename} in the directory: ${directory}`,
            );
        }
        await mkdir(directory, { recursive: true });
        const fullpath = path.join(directory, filename);
        await writeFile(fullpath, data);
        return fullpath;
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
        // this.logger.trace(`Removing folder at path: ${folderPath}`);

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

    getPendingStorageCachePath(repository) {
        return path.join(this.getDataFolderPath(), 'pending_storage_cache', repository);
    }

    getPendingStorageFolderPath(repository, blockchain, contract, tokenId) {
        return path.join(
            this.getPendingStorageCachePath(repository),
            `${blockchain.toLowerCase()}:${contract.toLowerCase()}:${tokenId}`,
        );
    }

    async getPendingStorageDocumentPath(repository, blockchain, contract, tokenId, assertionId) {
        const pendingStorageFolder = this.getPendingStorageFolderPath(
            repository,
            blockchain,
            contract,
            tokenId,
        );

        let pendingStorageFileName;
        if (assertionId === undefined) {
            [pendingStorageFileName] = await this.readDirectory(pendingStorageFolder);
        } else {
            pendingStorageFileName = assertionId;
        }

        return path.join(pendingStorageFolder, pendingStorageFileName);
    }

    getArchiveFolderPath(subFolder) {
        return path.join(this.getDataFolderPath(), ARCHIVE_FOLDER_NAME, subFolder);
    }
}

export default FileService;
