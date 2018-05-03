const Utilities = require('../Utilities');
const ArangoJS = require('./Arangojs');
const Neo4j = require('./Neo4j');

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
                reject(Error('Unable to connect to graph database'));
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
                case 'neo4j':
                    this.db = new Neo4j(
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
     * Find set of vertices from Graph storage
     * @param queryObject       Query for getting vertices
     * @returns {Promise<any>}
     */
    findVertices(queryObject) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findVertices(queryObject).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Finds traversal path starting from particular vertex
     * @param startVertex       Starting vertex
     * @returns {Promise<any>}
     */
    findTraversalPath(startVertex) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findTraversalPath(startVertex).then((result) => {
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

    /**
     * Updates document with the import ID
     * @param collectionName
     * @param document
     * @param importNumber
     */
    updateDocumentImports(collectionName, document, importNumber) {
        return this.db.updateDocumentImports(collectionName, document, importNumber);
    }

    /**
     * Create document collection, if collection does not exist
     * @param collectionName
     * @return {Promise}
     */
    createCollection(collectionName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.createCollection(collectionName).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Creates edge collection, if collection does not exist
     * @param collectionName
     * @return {Promise}
     */
    createEdgeCollection(collectionName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.createEdgeCollection(collectionName).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Get list of vertices by import ID
     * @param importId   Import ID
     * @return {Promise}
     */
    getVerticesByImportId(importId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.getVerticesByImportId(importId).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Gets edges by import ID from the underlying database
     * @param data_id       Import ID
     * @returns {Promise}
     */
    getEdgesByImportId(data_id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.getEdgesByImportId(data_id).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }
}

module.exports = GraphStorage;
