const Utilities = require('../Utilities');
const ArangoJS = require('./Arangojs');

const log = Utilities.getLogger();

class GraphStorage {
    constructor(selectedDatabase) {
        this.selectedDatabase = selectedDatabase;
    }

    /**
     * Connecting to graph database system selected in system database
     * @returns {Promise<any>}
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (!this.selectedDatabase) {
                reject(Error('Unable to connect ot graph database'));
            } else {
                switch (this.selectedDatabase.database_system) {
                case 'arango_db':
                    this.db = new ArangoJS(
                        this.selectedDatabase.username,
                        this.selectedDatabase.password,
                        this.selectedDatabase.database,
                        this.selectedDatabase.host,
                        this.selectedDatabase.port,
                    );
                    resolve(this.db);
                    break;
                default:
                    log.error(this.selectedDatabase);
                    reject(Error('Unsupported graph database system'));
                }
            }
        });
    }

    /**
     * Runs query on selected database
     * @param {string} - queryString - Query string
     * @param {object} - params - Query parameters
     * @returns {Promise<any>}
     */
    runQuery(queryString, params) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.runQuery(queryString, params).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Add new document into given collection on selected database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    addDocument(collectionName, document) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.addDocument(collectionName, document).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Update document in selected graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    updateDocument(collectionName, document) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.updateDocument(collectionName, document).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Get document from selected graph database
     * @param collectionName
     * @param document
     */
    getDocument(collectionName, documentKey) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.getDocument(collectionName, documentKey).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Identify selected graph database
     * @returns {string}
     */
    identify() {
        return this.db.identify();
    }

    /**
     * Gets underlying database information
     * @returns database info
     */
    getDatabaseInfo() {
        return this.selectedDatabase;
    }
}

module.exports = GraphStorage;
