const Utilities = require('../Utilities');
const ArangoJS = require('./Arangojs');
const Neo4j = require('./Neo4j');

const log = Utilities.getLogger();

class GraphStorage {
    constructor(selectedDatabase) {
        this.selectedDatabase = selectedDatabase;
        this._allowedClasses = ['Location', 'Actor', 'Product', 'Transport',
            'Transformation', 'Observation', 'Ownership'];
    }

    /**
     * Connecting to graph database system selected in system database
     * @returns {Promise<any>}
     */
    connect() {
        return new Promise(async (resolve, reject) => {
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
                    await this.__initDatabase__();
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
                    await this.__initDatabase__();
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
     * @return {Promise<void>}
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
     * Gets max version where uid is the same but not the _key
     * @param uid   Vertex uid
     * @param _key  Vertex _key
     * @return {Promise<void>}
     */
    getCurrentMaxVersion(uid, _key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.getCurrentMaxVersion(uid, _key).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Gets max vertex_key where uid is the same and has the max version
     * @param uid   Vertex uid
     * @return {Promise<void>}
     */
    getVertexWithMaxVersion(uid) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.getVertexWithMaxVersion(uid).then((result) => {
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

    /**
     *
     * @param className
     * @returns {Promise<string | undefined>}
     */
    async getClassId(className) {
        const id = this._allowedClasses.find(element => element.toLocaleLowerCase() ===
            className.toLocaleLowerCase());
        return id;
    }

    /**
     * Initializes database with predefined collections and vertices.
     * @returns {Promise<void>}
     * @private
     */
    async __initDatabase__() {
        await this.db.createCollection('ot_vertices');
        await this.db.createEdgeCollection('ot_edges');

        await Promise.all(this._allowedClasses.map(className => this.db.addDocument('ot_vertices', {
            _key: className,
            vertex_type: 'CLASS',
        })));
    }
}

module.exports = GraphStorage;
