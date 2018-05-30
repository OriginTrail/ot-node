const Utilities = require('../Utilities');
const ArangoJS = require('./Arangojs');
const Neo4j = require('./Neo4j');

const log = Utilities.getLogger();

class GraphStorage {
    /**
     * Default constructor
     * @param selectedDatabase Selected graph database
     */
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
                    try {
                        this.db = new ArangoJS(
                            this.selectedDatabase.username,
                            this.selectedDatabase.password,
                            this.selectedDatabase.database,
                            this.selectedDatabase.host,
                            this.selectedDatabase.port,
                        );
                        await this.__initDatabase__();
                        resolve(this.db);
                    } catch (error) {
                        console.log(error);
                        reject(Error('Unable to connect to graph database'));
                    }
                    break;
                case 'neo4j':
                    try {
                        this.db = new Neo4j(
                            this.selectedDatabase.username,
                            this.selectedDatabase.password,
                            this.selectedDatabase.database,
                            this.selectedDatabase.host,
                            this.selectedDatabase.port,
                        );
                        await this.__initDatabase__();
                        resolve(this.db);
                    } catch (error) {
                        reject(Error('Unable to connect to graph database'));
                    }
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
     * Finds imports IDs based on data location query
     *
     * DataLocationQuery structure: [[path, value, opcode]*]
     *
     * @param dataLocationQuery
     * @return {Promise}
     */
    findImportIds(dataLocationQuery) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findImportIds(dataLocationQuery).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Finds traversal path starting from particular vertex
     * @param depth             Traversal depth
     * @param startVertex       Starting vertex
     * @return {Promise<void>}
     */
    findTraversalPath(startVertex, depth) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findTraversalPath(startVertex, depth).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Gets max version where uid is the same but not the _key
     * @param senderId  Sender ID
     * @param uid       Vertex uid
     * @param _key      Vertex _key
     * @return {Promise<void>}
     */
    findMaxVersion(senderId, uid, _key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findMaxVersion(senderId, uid, _key).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Gets max vertex_key where uid is the same and has the max version
     * @param senderId  Sender ID
     * @param uid       Vertex uid
     * @return {Promise<void>}
     */
    findVertexWithMaxVersion(senderId, uid) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findVertexWithMaxVersion(senderId, uid).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Add vertex
     * @param vertex Vertex data
     * @returns {Promise<any>}
     */
    addVertex(vertex) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.addVertex(vertex).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Add edge
     * @param edge Edge data
     * @returns {Promise<any>}
     */
    addEdge(edge) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.addEdge(edge).then((result) => {
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
    * Get version of selected graph database
    * @returns {Promise<any>}
    */
    async version() {
        try {
            const result = await this.db.version(
                this.selectedDatabase.host, this.selectedDatabase.port,
                this.selectedDatabase.username, this.selectedDatabase.password,
            );
            return result;
        } catch (error) {
            throw error;
        }
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
    updateImports(collectionName, document, importNumber) {
        return this.db.updateImports(collectionName, document, importNumber);
    }

    /**
     * Updates edge imports by ID
     * @param senderId
     * @param uid
     * @param importNumber
     * @return {Promise<*>}
     */
    updateEdgeImportsByUID(senderId, uid, importNumber) {
        return this.db.updateEdgeImportsByUID(senderId, uid, importNumber);
    }

    /**
     * Updates vertex imports by ID
     * @param senderId
     * @param uid
     * @param importNumber
     * @return {Promise<*>}
     */
    updateVertexImportsByUID(senderId, uid, importNumber) {
        return this.db.updateVertexImportsByUID(senderId, uid, importNumber);
    }

    /**
     * Get list of vertices by import ID
     * @param importId   Import ID
     * @return {Promise}
     */
    findVerticesByImportId(importId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findVerticesByImportId(importId).then((result) => {
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
    findEdgesByImportId(data_id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findEdgesByImportId(data_id).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Find event based on ID and bizStep
     * Note: based on bizStep we define INPUT(shipping) or OUTPUT(receiving)
     * @param senderId    Sender ID
     * @param partnerId   Partner ID
     * @param documentId  Document ID
     * @param bizStep     Shipping/Receiving
     * @return {Promise}
     */
    findEvent(senderId, partnerId, documentId, bizStep) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findEvent(senderId, partnerId, documentId, bizStep).then((result) => {
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
        await this.db.initialize(this._allowedClasses);
    }
}

module.exports = GraphStorage;
