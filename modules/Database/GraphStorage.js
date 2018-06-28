const Utilities = require('../Utilities');
const ArangoJS = require('./Arangojs');
const Neo4j = require('./Neo4j');

class GraphStorage {
    /**
     * Default constructor
     * @param logger
     * @param selectedDatabase Selected graph database
     */
    constructor(selectedDatabase, logger) {
        this.logger = logger;
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
                            this.logger,
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
                            this.logger,
                        );
                        await this.__initDatabase__();
                        resolve(this.db);
                    } catch (error) {
                        reject(Error('Unable to connect to graph database'));
                    }
                    break;
                default:
                    this.logger.error(this.selectedDatabase);
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
     * Finds vertices by query defined in DataLocationRequestObject
     * @param inputQuery
     */
    async dataLocationQuery(inputQuery) {
        return this.db.dataLocationQuery(inputQuery);
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
     * Finds all object classes
     * @return {Promise<*>}
     */
    findObjectClassVertices() {
        return this.db.findObjectClassVertices();
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
     * @param import_id       Import ID
     * @returns {Promise}
     */
    findEdgesByImportId(import_id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else {
                this.db.findEdgesByImportId(import_id).then((result) => {
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
     * Extract vertices from virtual graph
     * @param virtual graph
     * @returns {JSON}
     */
    static getVerticesFromVirtualGraph(graph) {
        const virtualGraph = Utilities.copyObject(graph);
        const vertices = [];
        for (const key in virtualGraph.data) {
            delete virtualGraph.data[key].outbound;
            vertices.push(virtualGraph.data[key]);
        }
        return vertices;
    }

    /**
     * Extracts edges from virtual graph
     * @param virtual graph
     * @returns {JSON}
     */
    static getEdgesFromVirtualGraph(graph) {
        const virtualGraph = Utilities.copyObject(graph);
        const edges = [];
        for (const key in virtualGraph.data) {
            for (const edge in virtualGraph.data[key].outbound) {
                edges.push(virtualGraph.data[key].outbound[edge]);
            }
        }
        return edges;
    }

    /**
     * Imports virtual graph to database
     * @param virtual graph
     * @returns
     */
    async importVirtualGraph(virtualGraph) {
        const virtualEdges = GraphStorage.getEdgesFromVirtualGraph(virtualGraph);
        const virtualVertices = GraphStorage.getVerticesFromVirtualGraph(virtualGraph);

        const vertices = [];
        for (const i in virtualVertices) {
            vertices.push(this.db.addVertex(virtualVertices[i]));
        }
        await Promise.all(vertices);

        const edges = [];
        for (const i in virtualEdges) {
            edges.push(this.db.addEdge(virtualEdges[i]));
        }
        return Promise.all(edges);
    }

    /**
     * Gets the count of documents in collection.
     * @param collectionName
     * @returns {Promise}
     */
    getDocumentsCount(collectionName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(Error('Not connected to graph database'));
            } else if (this.db.identify === 'Neo4j') {
                reject(Error('Method not implemented for Neo4j database yet'));
            } else {
                this.db.getDocumentsCount(collectionName).then((result) => {
                    resolve(result);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    /**
     * Mimics commit opertaion
     * Removes inTransaction fields
     * @return {Promise<void>}
     */
    async commit() {
        await this.db.commit();
    }

    /**
     * Mimics rollback opertaion
     * Removes elements in transaction
     * @return {Promise<void>}
     */
    async rollback() {
        await this.db.rollback();
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
