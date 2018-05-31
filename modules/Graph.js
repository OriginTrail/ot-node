const Encryption = require('./Encryption');

const sysdb = require('./Database/SystemStorage');

/**
 * Graph class encapsulates every operation related to
 * graph manipulation such as traversing, transforming, etc.
 */
class Graph {
    /**
     * Traversing through the trail graph in Breadth-first manner
     * @param trailGraph          Virtual graph data
     * @param startVertexUID      Start vertex UID
     * @returns {Array}           traversal path
     */
    static bfs(trailGraph, startVertexUID) {
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

                    if (edge.edge_type !== 'EVENT_CONNECTION') {
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
                    if (edge.edge_type === 'EVENT_CONNECTION' && edge.transaction_flow === 'OUTPUT') {
                        // eslint-disable-next-line no-continue
                        continue; // don't follow output edges
                    }

                    visitedIds[toVertexId] = true;
                    queueToExplore.push(toVertexId);
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
            if (vertex.data) {
                vertex.data = Encryption.encryptObject(vertex.data, privateKey);
            }
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
            if (vertices[id].data) {
                vertices[id].data = Encryption.decryptObject(vertices[id].data, public_key);
            }
        }
        return vertices;
    }
}

module.exports = Graph;
