const path = require('path');
const { exists, mkdir } = require('fs');
const fs = require('fs');
const appRootPath = require('app-root-path');

const MIGRATION_FOLDER_NAME = 'migrations';

class FileService {
    constructor(ctx) {
        this.config = ctx.config;
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
    writeContentsToFile(directory, filename, data) {
        return new Promise((resolve, reject) => {
            mkdir(directory, { recursive: true }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    const fullpath = path.join(directory, filename);
                    try {
                        fs.writeFile(fullpath, data, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(fullpath);
                            }
                        });
                    } catch (e) {
                        reject(e);
                    }
                }
            });
        });
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

    _readFile(filePath, convertToJSON = false) {
        return new Promise((resolve, reject) => {
            exists(filePath, (exist) => {
                if (exist) {
                    fs.readFile(filePath, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            try {
                                if (convertToJSON) {
                                    const fileJson = JSON.parse(data);
                                    resolve(fileJson);
                                }
                                resolve(data.toString());
                            } catch (error) {
                                reject(error);
                            }
                        }
                    });
                } else {
                    reject(new Error(`File doesn't exist on file path: ${filePath}`));
                }
            });
        });
    }

    removeFile(filePath) {
        return new Promise((resolve, reject) => {
            exists(filePath, (exist) => {
                if (exist) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(true);
                        }
                    });
                } else {
                    resolve(false);
                }
            });
        });
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

    getHandlerIdCachePath() {
        return path.join(this.getDataFolderPath(), 'handler_id_cache');
    }

    getHandlerIdDocumentPath(handlerId) {
        return path.join(this.getHandlerIdCachePath(), handlerId);
    }
}

module.exports = FileService;
