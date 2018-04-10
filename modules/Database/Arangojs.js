const { Database } = require('arangojs');
const Utilities = require('./../Utilities');

const log = Utilities.getLogger();
const IGNORE_DOUBLE_INSERT = true;

class ArangoJS {
    /**
     * Creates new object connected with ArangoDB database,
     * with connection data found in system database
     * @constructor
     * @param {string} - username
     * @param {string} - password
     * @param {string} - database
     * @param {string} - host
     * @param {number} - port
     */
    constructor(username, password, database, host, port) {
        this.db = new Database(`http://${host}:${port}`);
        this.db.useDatabase(database);
        this.db.useBasicAuth(username, password);
    }

    /**
     * Creates vertex collection
     * @param collection_name
     * @returns {Promise<any>}
     */
    async createVertexCollection(collection_name) {
        return new Promise((resolve, reject) => {
            const collection = this.db.collection(collection_name);
            collection.create().then(
                () => {
                    log.info('Document collection created');
                    resolve(true);
                },
                (err) => {
                    if (err.response.body.code === 409) {
                        log.info('Document collection already exists');
                    } else {
                        log.info(err);
                    }
                    reject(err);
                },
            );
        });
    }

    /**
     * Creates edge collection
     * @param collection_name
     * @returns {Promise<any>}
     */
    async createEdgeCollection(collection_name) {
        return new Promise((resolve, reject) => {
            const collection = this.db.edgeCollection(collection_name);
            collection.create().then(
                () => {
                    log.info('Edge collection created');
                    resolve(true);
                },
                (err) => {
                    if (err.response.body.code === 409) {
                        log.info('Edge collection already exists');
                    } else {
                        log.info(err);
                    }
                    reject(err);
                },
            );
        });
    }


    addVertex(collection_name, vertex, callback) {
        const collection = this.db.collection(collection_name);
        collection.save(vertex).then(
            meta => Utilities.executeCallback(callback, true),
            (err) => {
                // console.error('Failed to save document:', err)
                Utilities.executeCallback(callback, false);
            },
        );
    }

    addEdge(collection_name, edge, callback) {
        const collection = this.db.collection(collection_name);
        collection.save(edge).then(
            meta => Utilities.executeCallback(callback, true),
            (err) => {
                // console.error('Failed to save document:', err)
                Utilities.executeCallback(callback, false);
            },
        );
    }

    updateDocumentImports(collection_name, document_key, import_number, callback) {
        const collection = this.db.collection(collection_name);
        collection.document(document_key).then(
            (doc) => {
                var imports = [];
                if (doc !== undefined && doc.imports !== undefined) {
                    /* eslint-disable-next-line prefer-destructuring */
                    imports = doc.imports;
                }
                if (imports.indexOf(import_number) === -1) {
                    imports.push(import_number);
                    collection.update(document_key, { imports }).then(
                        meta => Utilities.executeCallback(callback, true),
                        (err) => {
                            log.info(err);
                            Utilities.executeCallback(callback, false);
                        },
                    );
                }
            },
            (err) => {
                log.info(err);
                Utilities.executeCallback(callback, false);
            },
        );
    }

    /**
     * Run query on ArangoDB graph database
     * @param {string} - queryString
     * @param {object} - params
     * @returns {Promise<any>}
     */
    runQuery(queryString, params) {
        return new Promise((resolve, reject) => {
            try {
                this.db.query(queryString, params).then((cursor) => {
                    resolve(cursor.all());
                }).catch((err) => {
                    console.log(err);
                    reject(err);
                });
            } catch (err) {
                console.log(err);
                reject(err);
            }
        });
    }

    /**
     * Inserts document into ArangoDB graph database for given collection name
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    addDocument(collectionName, document) {
        return new Promise((resolve, reject) => {
            const collection = this.db.collection(collectionName);
            collection.save(document).then(
                meta => resolve(meta),
                (err) => {
                    const errorCode = err.response.body.code;
                    if (IGNORE_DOUBLE_INSERT) {
                        resolve('Double insert');
                    } else {
                        reject(err);
                    }
                },
            ).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Update document in ArangoDB graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    updateDocument(collectionName, document) {
        return new Promise((resolve, reject) => {
            const collection = this.db.collection(collectionName);
            collection.update(document._key, document).then(
                (meta) => {
                    resolve(meta);
                },
                (err) => {
                    reject(err);
                },
            ).catch((err) => {
                console.log(err);
            });
        });
    }

    /**
     * Get document from ArangoDB graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    getDocument(collectionName, documentKey) {
        return new Promise((resolve, reject) => {
            const collection = this.db.collection(collectionName);
            collection.document(documentKey).then(
                (res) => {
                    resolve(res);
                },
                (err) => {
                    reject(err);
                },
            ).catch((err) => {
                console.log(err);
            });
        });
    }


    /**
     * Identify selected database as ArangoJS
     * @returns {string} - Graph database identifier string
     */
    identify() {
        return 'ArangoJS';
    }

    /**
     * Create document collection, if collection does not exist
     * @param collectionName
     */
    createCollection(collectionName) {
        return new Promise((resolve, reject) => {
            const collection = this.db.collection(collectionName);
            collection.create().then(
                () => {
                    resolve('Collection created');
                },
                (err) => {
                    console.log(err);
                    const errorCode = err.response.body.code;
                    if (errorCode === 409 && IGNORE_DOUBLE_INSERT) {
                        resolve('Double insert');
                    } else {
                        reject(err);
                    }
                },
            ).catch((err) => {
                console.log(err);
            });
        });
    }
}

module.exports = ArangoJS;
