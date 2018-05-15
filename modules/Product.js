const fs = require('fs');

const Graph = require('./Graph');
const GraphInstance = require('./GraphInstance');
const GraphStorageInstance = require('./GraphStorageInstance');
const Utilities = require('./Utilities');

/**
 * Creates product journey
 * @param virtualGraph          Virtual graph data
 * @param traversal             Current traversal from a particular node
 * @returns {Array}             Journey
 * @private
 */
function _getProductJourney(virtualGraph, traversal) {
    const journey = [];
    const batches = [];
    const usedBatchUIDs = [];
    const transactions = [];
    const usedTransactionIDs = [];

    for (let i = 0; i < traversal.length; i += 1) {
        const vertex = traversal[i];
        if (vertex.vertex_type === 'BATCH' && usedBatchUIDs[vertex.identifiers.uid] !== true) {
            const edges = vertex.outbound;

            for (const j in edges) {
                if (edges[j].edge_type === 'INSTANCE_OF') {
                    vertex.product_info = virtualGraph[edges[j].to];
                } else if (edges[j].edge_type === 'OUTPUT_BATCH' || edges[j].edge_type === 'OF_BATCH') {
                    const event = virtualGraph[edges[j].to];
                    const event_edges = event.outbound;

                    for (i in event_edges) {
                        if (event_edges[i].edge_type === 'AT') {
                            vertex.location = virtualGraph[event_edges[i].to];
                        }
                    }
                }
            }
            usedBatchUIDs[vertex.identifiers.uid] = true;
            batches.push(vertex);
        }

        if (vertex.vertex_type === 'TRANSACTION' && usedTransactionIDs[vertex.identifiers.TransactionId] !== true) {
            usedTransactionIDs[vertex.identifiers.TransactionId] = true;
            transactions.push(vertex);
        }
    }
    let i = 1;
    let j = 0;

    if (batches.length > 0) {
        journey.push(batches[0]);
    }

    while (i < batches.length && j < transactions.length) {
        journey.push(transactions[j += 1]);
        journey.push(batches[i += 1]);
    }

    if (i < batches.length) {
        journey.push(batches[i]);
    }
    return journey;
}

/**
 * Encapsulates product related operations
 */
class Product {
    /**
     * Gets trail based on query parameter map
     * @param queryObject   Query parameter map
     * @returns {Promise}
     */
    getTrail(queryObject) {
        return new Promise((resolve, reject) => {
            let restricted = false;

            if (queryObject.restricted !== undefined) {
                restricted = { queryObject };
                delete queryObject.restricted;
            }

            GraphStorageInstance.db.findVertices(queryObject).then((vertices) => {
                if (vertices.length === 0) {
                    resolve([]);
                    return;
                }

                const start_vertex = vertices[0];
                const depth = GraphStorageInstance.db.getDatabaseInfo().max_path_length;
                GraphStorageInstance.db.findTraversalPath(start_vertex, depth)
                    .then((virtualGraph) => {
                        virtualGraph = this.consensusCheck(virtualGraph);
                        const returnBFS = Utilities.copyObject(virtualGraph);

                        const BFSt = Graph.bfs(
                            Utilities.copyObject(returnBFS.data),
                            start_vertex.identifiers.uid,
                            true,
                        );

                        for (const i in BFSt) {
                            if (BFSt[i].outbound !== undefined) {
                                delete BFSt[i].outbound;
                            }
                        }

                        // Sorting keys in object for uniform response
                        // eslint-disable-next-line no-redeclare
                        for (const i in BFSt) {
                            BFSt[i] = Utilities.sortObject(BFSt[i]);
                        }

                        const BFS = Graph.bfs(
                            Utilities.copyObject(virtualGraph.data),
                            start_vertex.identifiers.uid,
                            restricted,
                        );

                        const fetchedJourney = _getProductJourney(
                            Utilities.copyObject(virtualGraph.data),
                            Utilities.copyObject(BFS),
                        );


                        const responseObject = {
                            graph: virtualGraph.data,
                            traversal: BFSt,
                            journey: fetchedJourney,
                            sha3: Utilities.sha3(JSON.stringify(BFSt)),
                        };
                        resolve(responseObject);
                    }).catch((err) => {
                        reject(err);
                    });
            });
        });
    }

    /**
     * Go through the virtual graph and calculate consensus check
     * @param virtualGraph
     */
    consensusCheck(virtualGraph) {
        const graph = virtualGraph.data;
        for (const key in graph) {
            const vertex = graph[key];
            if (vertex.vertex_type === 'EVENT') {
                for (const neighbourEdge of vertex.outbound) {
                    if (neighbourEdge.edge_type === 'EVENT_CONNECTION') {
                        const neighbour = graph[neighbourEdge.to];
                        const distance = Utilities.objectDistance(vertex.data, neighbour.data);
                        if (!vertex.consensus) {
                            vertex.consensus = distance;
                        }
                    }
                }
            }
        }
        return virtualGraph;
    }

    /**
     * Gets trail based on product UID
     * @param uid
     * @returns {Promise}
     */
    getTrailByUID(uid) {
        return new Promise((resolve, reject) => {
            const queryObject = {
                uid,
            };
            this.getTrail(queryObject).then((res) => {
                resolve(res);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Gets trail based on every query parameter
     * @param queryObject
     * @returns {Promise}
     */
    getTrailByQuery(queryObject) {
        return new Promise((resolve, reject) => {
            this.getTrail(queryObject).then((res) => {
                resolve(res);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Hashes trail and writes it to a file
     * @param trail
     * @param startVertexUID
     * @returns {string}
     */
    hashTrail(trail, startVertexUID) {
        const bfsTraversal = GraphInstance.g.bfs(trail, startVertexUID, true);
        for (const i in bfsTraversal) {
            if (bfsTraversal[i].outbound !== undefined) {
                delete bfsTraversal[i].outbound;
            }
        }
        for (const i in bfsTraversal) {
            bfsTraversal[i] = Utilities.sortObject(bfsTraversal[i]);
        }

        // Import log entry
        const bfsTraversalJson = JSON.stringify(bfsTraversal);
        fs.appendFile('import-log.txt', `\n\n-----------------\n UID: ${startVertexUID}\n\nUID hash: ${Utilities.sha3(startVertexUID)}\n\nTraversal: ${bfsTraversalJson}\n\nTraversal hashed: ${Utilities.sha3(bfsTraversalJson)}\n\n-----------------\n\n`, 'utf8', () => {
        });
        return Utilities.sha3(bfsTraversalJson);
    }
}

module.exports = Product;

