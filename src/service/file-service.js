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
    async writeContentsToFile(directory, filename, data) {
        this.logger.debug(`Saving file with name: ${filename} in directory: ${directory}`);
        await mkdir(directory, { recursive: true });
        const fullpath = path.join(directory, filename);
        await writeFile(fullpath, data);
        return fullpath;
    }

    readFileOnPath(filePath) {
        return this._readFile(filePath, false);
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
        } catch (e) {
            return false;
        }
    }

    async _readFile(filePath, convertToJSON = false) {
        this.logger.debug(
            `Reading file on path: ${filePath}, converting to json: ${convertToJSON}`,
        );
        try {
            const data = await readFile(filePath);
            return convertToJSON ? JSON.parse(data) : data.toString();
        } catch (e) {
            throw Error(`File doesn't exist on file path: ${filePath}`);
        }
    }

    async removeFile(filePath) {
        if (await this.fileExists(filePath)) {
            this.logger.trace(`Removing file on path: ${filePath}`);
            await unlink(filePath);
            return true;
        }
        this.logger.debug(`File doesn't exist on file path: ${filePath}`);
        return false;
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

    async removeExpiredCacheFiles(expiredTimeout) {
        const cacheFolderPath = this.getOperationIdCachePath();
        const cacheFolderExists = await this.fileExists(cacheFolderPath);
        if (!cacheFolderExists) {
            return;
        }
        const fileList = await readdir(cacheFolderPath);
        const deleteFile = async (fileName) => {
            const filePath = path.join(cacheFolderPath, fileName);
            const now = new Date();
            const createdDate = (await stat(filePath)).mtime;
            if (createdDate.getTime() + expiredTimeout < now.getTime()) {
                await this.removeFile(filePath);
                return true;
            }
            return false;
        };
        const deleted = await Promise.all(fileList.map((fileName) => deleteFile(fileName)));
        return deleted.filter((x) => x).length;
    }
}

export default FileService;
