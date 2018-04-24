const Utilities = require('./Utilities');
const Encryption = require('./Encryption');

const sysdb = require('./Database/SystemStorage');
const GraphStorage = require('./GraphStorageInstance');

/**
 * Graph class encapsulates every operation related to
 * graph manipulation such as traversing, transforming, etc.
 */
class Graph {
    /**
     * Find set of vertices from Graph storage
     * @param queryObject       Query for getting vertices
     * @returns {Promise<any>}
     */
    findVertices(queryObject) {
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

            GraphStorage.db.runQuery(queryString, params).then((result) => {
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
        return new Promise((resolve, reject) => {
            if (startVertex === undefined || startVertex._id === undefined) {
                resolve([]);
                return;
            }
            const maxPathLength = GraphStorage.db.getDatabaseInfo().max_path_length;
            const queryString = `FOR vertice, edge, path IN 1 .. ${maxPathLength}
            OUTBOUND '${startVertex._id}'
            GRAPH 'origintrail_graph'
            RETURN path`;

            GraphStorage.db.runQuery(queryString).then((result) => {
                resolve(result);
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

    /**
     * Traversing through the trail graph in Breadth-first manner
     * @param trailGraph          Virtual graph data
     * @param startVertexUID      Start vertex UID
     * @param restrictToBatch     Restrict traversal to batch
     * @returns {Array}           traversal path
     */
    static bfs(trailGraph, startVertexUID, restrictToBatch = false) {
        if (trailGraph == null) {
            return []; // return empty traversal path
        }

        let startVertexId = null;
        for (const id in trailGraph) {
            if (trailGraph[id].identifiers.uid === startVertexUID) {
                startVertexId = id;
                break;
            }
        }
        if (startVertexId == null) {
            return []; // return empty traversal path
        }

        const visitedIds = [];
        const traversalPath = [];
        const queueToExplore = [];
        queueToExplore.push(startVertexId);
        visitedIds[startVertexId] = true;

        while (queueToExplore.length > 0) {
            const currentVertexId = queueToExplore.shift();

            const currentVertex = trailGraph[currentVertexId];
            if (currentVertex !== undefined) {
                traversalPath.push(currentVertex);

                for (const edgeId in currentVertex.outbound) {
                    const edge = currentVertex.outbound[edgeId];
                    const toVertexId = edge.to;

                    if (edge.edge_type !== 'TRANSACTION_CONNECTION') {
                        traversalPath.push(edge);
                    }

                    if (visitedIds[toVertexId] !== undefined) {
                        // eslint-disable-next-line no-continue
                        continue; // it's already visited
                    }

                    const toVertex = trailGraph[toVertexId];
                    if (toVertex === undefined) {
                        // eslint-disable-next-line no-continue
                        continue; // it doesn't exist (should not happen)
                    }

                    // don't follow the output flow
                    if (edge.edge_type === 'TRANSACTION_CONNECTION' && edge.TransactionFlow === 'Output') {
                        // eslint-disable-next-line no-continue
                        continue; // don't follow output edges
                    }

                    if (restrictToBatch === false || (toVertex.vertex_type !== 'BATCH' && edge.edge_type !== 'TRANSACTION_CONNECTION')) {
                        visitedIds[toVertexId] = true;
                        queueToExplore.push(toVertexId);
                    }
                }
            }
        }
        return traversalPath;
    }

    /**
     * Encrypts vertices with stored keys if they exist or with new created ones otherwise
     * @param dhWallet      DH node wallet
     * @param dhKademliaId  DH node Kademlia ID
     * @param vertices      Vertices to be encrypted
     */
    static encryptVertices(dhWallet, dhKademliaId, vertices) {
        return new Promise((resolve, reject) => {
            sysdb.connect().then(() => {
                const selectQuerySQL = 'SELECT dh.data_private_key, dh.data_public_key from data_holders as dh where dh.dh_wallet=? and dh.dh_kademlia_id=?';

                sysdb.runSystemQuery(selectQuerySQL, [dhWallet, dhKademliaId]).then((rows) => {
                    if (rows.length > 0) {
                        const privateKey = rows[0].data_private_key;
                        const publicKey = rows[0].data_public_key;

                        Graph.encryptVerticesWithKeys(vertices, privateKey, publicKey);
                        resolve({ vertices, public_key: publicKey });
                    } else {
                        const keyPair = Encryption.generateKeyPair();
                        const updateKeysSQL = 'INSERT INTO data_holders (data_private_key, data_public_key, dh_wallet, dh_kademlia_id)VALUES (?, ?, ?, ?)';
                        const updateQueryParams = [
                            keyPair.privateKey,
                            keyPair.publicKey,
                            dhWallet,
                            dhKademliaId];

                        sysdb.runSystemUpdate(updateKeysSQL, updateQueryParams).then(() => {
                            Graph.encryptVerticesWithKeys(
                                vertices, keyPair.privateKey,
                                keyPair.publicKey,
                            );
                            resolve({ vertices, public_key: keyPair.publicKey });
                        }).catch((err) => {
                            reject(err);
                        });
                    }
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Encrypt vertices data with specified public and private keys
     * @param vertices    Vertices to be encrypted
     * @param privateKey  Private key used for encryption
     * @param publicKey   Public key used for decryption
     */
    static encryptVerticesWithKeys(vertices, privateKey, publicKey) {
        for (const id in vertices) {
            const vertex = vertices[id];
            vertex.data = Encryption.encryptObject(vertex.data, privateKey);
            vertex.decryption_key = publicKey;
        }
    }

    /**
     * Decrypts vertices with a public key
     * @param vertices      Encrypted vertices
     * @param public_key    Public key
     * @returns {*}
     */
    static decryptVertices(vertices, public_key) {
        for (const id in vertices) {
            vertices[id].data = Encryption.decryptObject(vertices[id].data, public_key);
        }
        return vertices;
    }
}


module.exports = Graph;
