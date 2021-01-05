const MongoDB = require('./MongoDB');

class DocumentStorage {
    /**
     * Default constructor
     * @param logger
     */
    constructor(logger) {
        this.logger = logger;
    }

    /**
     * Connecting to document database system selected in system database
     * @returns {Promise<any>}
     */
    connect() {
        return new Promise(async (resolve, reject) => {
            this.db = new MongoDB(
                'origintrail',
                'staging_data',
                this.logger,
            );
            await this.__initDatabase__();
            resolve(this.db);
        });
    }

    createStagingData(object) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to document database.'));
            } else {
                this.db.createStagingData(object).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    removeStagingData(objectIDs) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to document database.'));
            } else {
                this.db.removeStagingData(objectIDs).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    findStagingData() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to document database.'));
            } else {
                this.db.findStagingData().then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    findAndRemoveStagingData() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to document database.'));
            } else {
                this.db.findAndRemoveStagingData().then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Initializes database with predefined collections.
     * @returns {Promise<void>}
     * @private
     */
    async __initDatabase__() {
        await this.db.initialize();
    }

    /**
     * Identify selected document database
     * @returns {string}
     */
    identify() {
        return this.db.identify();
    }
}

module.exports = DocumentStorage;
