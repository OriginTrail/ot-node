const Utilities = require('./utilities');
const Encryption = require('./encryption');
const SystemStorage = require('./Database/systemStorage');

/**
 * Private utility method used for encrypting a set of vertices
 * @param vertices    Vertices to be encrypted
 * @param privateKey  Private key used for encryption
 * @param publicKey   Public key used for decryption
 */
function encryptVertices(vertices, privateKey, publicKey) {
    for (const id in vertices) {
        const vertex = vertices[id];
        vertex.data = Encryption.encryptObject(vertex.data, privateKey);
        vertex.decryption_key = publicKey;
    }
}

/**
 * Graph class encapsulates every operation related to
 * graph manipulation such as traversing, transforming, etc.
 */
class Graph {
    /**
     * Creates Graph abstraction
     * @constructor
     * @param graphStorage Graph storage
     */
    constructor(graphStorage) {
        this.graphStorage = graphStorage;
    }

    /**
     * Find vertex from Graph storage
     * @param queryObject       Query for getting vertices
     * @returns {Promise<any>}
     */
    findVertex(queryObject) {
        return new Promise((resolve, reject) => {
            let queryString = 'FOR v IN ot_vertices ';
            const params = {};
            if (Utilities.isEmptyObject(queryObject) === false) {
                queryString += 'FILTER ';

                const filters = [];

                let count = 1;
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

            this.graphStorage.runQuery(queryString, params).then((result) => {
                resolve(result);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Runs traversal starting from particular vertex
     * @param startVertex      Starting vertex
     * @returns {Promise<any>}
     */
    runTraversal(startVertex) {
        return new Promise((resolve, reject) => {
            if (startVertex === undefined || startVertex._id === undefined) {
                resolve([]);
                return;
            }
            /*eslint-disable */
            const maxPathLength = this.graphStorage.getDatabaseInfo().max_path_length;
            const queryString = `FOR v, e, p IN 1 .. ${maxPathLength}
            OUTBOUND '${startVertex._id}'
            GRAPH 'origintrail_graph'
            RETURN p`;
            /* eslint-enable */

            this.graphStorage.runQuery(queryString).then((result) => {
                resolve(result);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Transforms raw graph data to virtual one (without
     * @param rawGraph
     * @returns {{}}
     */
    static convertToVirtualGraph(rawGraph) {
        const vertices = {};
        const edges = {};
        const list = {};

        for (const vertexId in rawGraph) {
            const vertex = rawGraph[vertexId];
            if (vertex.edges === undefined) {
                // eslint-disable-next-line no-continue
                continue;
            }

            for (const edgeId in rawGraph[vertexId].edges) {
                if (vertex.edges[edgeId] !== null) {
                    // eslint-disable-next-line no-underscore-dangle,no-param-reassign
                    vertex.edges[edgeId].key = vertex.edges[edgeId]._key;
                    // eslint-disable-next-line max-len
                    // eslint-disable-next-line no-underscore-dangle,no-param-reassign,prefer-destructuring
                    vertex.edges[edgeId].from = vertex.edges[edgeId]._from.split('/')[1];
                    // eslint-disable-next-line no-underscore-dangle,prefer-destructuring
                    vertex.edges[edgeId].to = vertex.edges[edgeId]._to.split('/')[1];

                    delete vertex.edges[edgeId]._key;
                    delete vertex.edges[edgeId]._id;
                    delete vertex.edges[edgeId]._rev;
                    delete vertex.edges[edgeId]._to;
                    delete vertex.edges[edgeId]._from;

                    // eslint-disable-next-line  prefer-destructuring
                    const key = vertex.edges[edgeId].key;
                    if (edges[key] === undefined) {
                        edges[key] = vertex.edges[edgeId];
                    }
                }
            }

            if (vertex.vertices !== undefined) {
                for (const j in rawGraph[vertexId].vertices) {
                    if (vertex.vertices[j] !== null) {
                        vertex.vertices[j].key = vertex.vertices[j]._key;
                        vertex.vertices[j].outbound = [];

                        delete vertex.vertices[j]._key;
                        delete vertex.vertices[j]._id;
                        delete vertex.vertices[j]._rev;

                        // eslint-disable-next-line  prefer-destructuring
                        const key = vertex.vertices[j].key;

                        if (vertices[key] === undefined) {
                            vertices[key] = vertex.vertices[j];
                        }
                    }
                }
            }
        }

        for (const vertexId in vertices) {
            list[vertices[vertexId].key] = vertices[vertexId];
        }
        for (const edgeId in edges) {
            list[edges[edgeId].from].outbound.push(edges[edgeId]);
        }
        return {
            data: list,
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
     * @param dhKademilaId  DH node Kademlia ID
     * @param vertices      Vertices to be encrypted
     */
    static encryptVertices(dhWallet, dhKademilaId, vertices) {
        return new Promise((resolve, reject) => {
            const sysdb = new SystemStorage();

            sysdb.connect().then(() => {
                const selectQuerySQL = 'SELECT dh.data_private_key, dh.data_public_key from data_holders as dh where dh.dh_wallet=? and dh.dh_kademlia_id=?';

                sysdb.runSystemQuery(selectQuerySQL, [dhWallet, dhKademilaId]).then((rows) => {
                    if (rows.length > 0) {
                        // keys found
                        const privateKey = rows[0].data_private_key;
                        const publicKey = rows[0].data_public_key;

                        encryptVertices(vertices, privateKey, publicKey);
                        resolve({ vertices, public_key: publicKey });
                    } else {
                        // there are no keys
                        const keyPair = Encryption.generateKeyPair();
                        const updateKeysSQL = 'UPDATE data_holders SET data_private_key=? and data_public_key=? where dh_wallet=? and dh_kademlia_id=?';

                        /* eslint-disable max-len */
                        sysdb.runSystemUpdate(updateKeysSQL, [keyPair.privateKey, keyPair.publicKey, dhWallet, dhKademilaId]).then(() => {
                            encryptVertices(vertices, keyPair.privateKey, keyPair.publicKey);
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
