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


    updateDocumentImports(collectionName, document, importNumber) {
        return new Promise((resolve, reject) => {
            this.getDocument(collectionName, document).then((document) => {
                var new_imports = [];
                if (document.imports !== undefined) {
                    new_imports = document.imports;
                }

                new_imports.push(importNumber);

                document.imports = new_imports;
                this.updateDocument(collectionName, document).then((meta) => {
                    resolve(meta);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
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
            const queryString = 'FOR v IN ot_vertices ' +
                'FILTER v.identifiers.uid == @uid AND AND v._key != @_key ' +
                'SORT v.version DESC ' +
                'LIMIT 1 ' +
                'RETURN v.version';
            const params = {
                uid,
                _key,
            };

            this.runQuery(queryString, params).then((result) => {
                resolve(result);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Gets max vertex_key where uid is the same and has the max version
     * @param uid   Vertex uid
     * @return {Promise<void>}
     */
    getVertexKeyWithMaxVersion(uid) {
        return new Promise((resolve, reject) => {
            const queryString = 'FOR v IN ot_vertices ' +
                'FILTER v.identifiers.uid == @uid ' +
                'SORT v.version DESC ' +
                'LIMIT 1 ' +
                'RETURN v.vertex_key';
            const params = {
                uid,
            };

            this.runQuery(queryString, params).then((result) => {
                resolve(result);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Run query on ArangoDB graph database
     * @param {string} - queryString
     * @param {object} - params
     * @returns {Promise<any>}
     */
    runQuery(queryString, params) {
        return new Promise((resolve, reject) => {
            this.db.query(queryString, params).then((cursor) => {
                resolve(cursor.all());
            }).catch((err) => {
                reject(err);
            });
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
                    if (errorCode === 409 && IGNORE_DOUBLE_INSERT) {
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
                reject(err);
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
                reject(err);
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
                    const errorCode = err.response.body.code;
                    if (errorCode === 409 && IGNORE_DOUBLE_INSERT) {
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

    createEdgeCollection(collectionName) {
        return new Promise((resolve, reject) => {
            const collection = this.db.edgeCollection(collectionName);
            collection.create().then(
                () => {
                    resolve('Edge collection created');
                },
                (err) => {
                    const errorCode = err.response.body.code;
                    if (errorCode === 409 && IGNORE_DOUBLE_INSERT) {
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

    getVerticesByImportId(data_id) {
        return new Promise((resolve, reject) => {
            const queryString = 'FOR v IN ot_vertices FILTER POSITION(v.imports, @importId, false) != false SORT v._key RETURN v';

            if (typeof data_id !== 'number') {
                data_id = parseInt(data_id, 10);
            }

            const params = { importId: data_id };

            this.runQuery(queryString, params).then((response) => {
                resolve(response);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    getEdgesByImportId(data_id) {
        return new Promise((resolve, reject) => {
            const queryString = 'FOR v IN ot_edges FILTER POSITION(v.imports, @importId, false) != false SORT v._key RETURN v';

            if (typeof data_id !== 'number') {
                data_id = parseInt(data_id, 10);
            }

            const params = { importId: data_id };

            this.runQuery(queryString, params).then((response) => {
                resolve(response);
            }).catch((err) => {
                reject(err);
            });
        });
    }
}

module.exports = ArangoJS;
