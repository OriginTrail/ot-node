const path = require('path');
const { exists, mkdir } = require('fs');
const fs = require('fs');

class FileService {
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

                    fs.writeFile(fullpath, data, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(fullpath);
                        }
                    });
                }
            });
        });
    }

    createFolder(folderName) {

    }

    readFileOnPath(filePath) {

    }

    /**
     * Loads JSON data from file
     * @returns {Promise<JSON object>}
     * @private
     */
    loadJsonFromFile(filePath) {
        return new Promise((resolve, reject) => {
            exists(filePath, (exists) => {
                if (exists) {
                    fs.readFile(filePath, (err, data) => {
                        if (err) {
                            reject(err);
                        } else {
                            try {
                                const fileJson = JSON.parse(data);
                                resolve(fileJson);
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
}

module.exports = FileService;
