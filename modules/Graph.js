const Encryption = require('./Encryption');

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
     * Encrypt vertices data with specified private key.
     *
     * All vertices that has data property will be encrypted with given private key.
     * @param vertices Vertices to encrypt
     * @param privateKey Encryption key
     */
    static encryptVertices(vertices, privateKey) {
        for (const id in vertices) {
            const vertex = vertices[id];
            if (vertex.data) {
                vertex.data = Encryption.encryptObject(vertex.data, privateKey);
            }
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

    /**
     * Sort vertices according to their keys
     * @param vertices
     * @return {*}
     */
    static sortVertices(vertices) {
        vertices.sort((a, b) => {
            if (a._key < b._key) {
                return -1;
            } else if (a._key > b._key) {
                return 1;
            }
            return 0;
        });
        return vertices;
    }
}

module.exports = Graph;
