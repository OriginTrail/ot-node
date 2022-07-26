const path = require('path');
const { mkdir, writeFile, readFile, unlink, stat } = require('fs/promises');
const appRootPath = require('app-root-path');

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

    createFolder(folderName) {}

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
        this.logger.debug(`Removing file on path: ${filePath}`);
        let successful = false;
        try {
            await unlink(filePath);
            successful = true;
        } catch (e) {}
        return successful;
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
}

module.exports = FileService;
