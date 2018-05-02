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
     * Find set of vertices
     * @param queryObject       Query for getting vertices
     * @returns {Promise<any>}
     */
    findVertices(queryObject) {
        const that = this;
        return new Promise((resolve, reject) => {
            let queryString = 'FOR v IN ot_vertices ';
            const params = {};
            if (Utilities.isEmptyObject(queryObject) === false) {
                queryString += 'FILTER ';

                let count = 1;
                const filters = [];
                for (const key in queryObject) {
                    if (key.match(/^[\w\d]+$/g) !== null) {
                        let searchKey;
                        if (key !== 'vertex_type' && key !== '_key') {
                            searchKey = `identifiers.${key}`;
                        } else {
                            searchKey = key;
                        }
                        const param = `param${count}`;
                        filters.push(`v.${searchKey} == @param${count}`);

                        count += 1;
                        params[param] = queryObject[key];
                    }
                }
                queryString += filters.join(' AND ');
            }
            queryString += ' RETURN v';
            that.runQuery(queryString, params).then((result) => {
                resolve(result);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Finds traversal path starting from particular vertex
     * @param startVertex       Starting vertex
     * @returns {Promise<any>}
     */
    findTraversalPath(startVertex) {
        const that = this;
        return new Promise((resolve, reject) => {
            if (startVertex === undefined || startVertex._id === undefined) {
                resolve([]);
                return;
            }
            const maxPathLength = that.getDatabaseInfo().max_path_length;
            const queryString = `FOR vertice, edge, path IN 1 .. ${maxPathLength}
            OUTBOUND '${startVertex._id}'
            GRAPH 'origintrail_graph'
            RETURN path`;

            that.runQuery(queryString).then((result) => {
                resolve(ArangoJS.convertToVirtualGraph(result));
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Transforms raw graph data to virtual one (without
     * @param rawGraph  Raw graph structure
     * @returns {{}}
     */
    static convertToVirtualGraph(rawGraph) {
        const resultList = {};
        const resultEdges = {};
        const resultVertices = {};

        for (const id in rawGraph) {
            const graph = rawGraph[id];
            if (graph.edges == null) {
                // eslint-disable-next-line no-continue
                continue;
            }

            for (const edgeId in graph.edges) {
                const edge = graph.edges[edgeId];
                if (edge !== null) {
                    edge.key = edge._key;
                    // eslint-disable-next-line no-underscore-dangle,prefer-destructuring
                    edge.from = edge._from.split('/')[1];
                    // eslint-disable-next-line no-underscore-dangle,prefer-destructuring
                    edge.to = edge._to.split('/')[1];

                    delete edge._key;
                    delete edge._id;
                    delete edge._rev;
                    delete edge._to;
                    delete edge._from;

                    // eslint-disable-next-line  prefer-destructuring
                    const key = edge.key;
                    if (resultEdges[key] === undefined) {
                        resultEdges[key] = edge;
                    }
                }
            }

            if (graph.vertices !== undefined) {
                for (const vertexId in graph.vertices) {
                    const vertex = graph.vertices[vertexId];
                    if (vertex !== null) {
                        vertex.key = vertex._key;
                        vertex.outbound = [];

                        delete vertex._key;
                        delete vertex._id;
                        delete vertex._rev;

                        // eslint-disable-next-line  prefer-destructuring
                        const key = vertex.key;
                        if (resultVertices[key] === undefined) {
                            resultVertices[key] = vertex;
                        }
                    }
                }
            }
        }

        for (const vertexId in resultVertices) {
            resultList[resultVertices[vertexId].key] = resultVertices[vertexId];
        }
        for (const edgeId in resultEdges) {
            resultList[resultEdges[edgeId].from].outbound.push(resultEdges[edgeId]);
        }
        return {
            data: resultList,
        };
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
