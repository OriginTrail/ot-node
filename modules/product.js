// External modules
const utilities = require('./utilities');

const log = utilities.getLogger();
const database = require('./database')();
const graph = require('./graph')();
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;

const fs = require('fs');

module.exports = function () {
    // Private function
    function getProductJourney(virtual_graph_data, traversal) {
        const journey = [];
        const batches = [];
        const usedBatchUIDs = [];
        const batchUIDs = [];
        const transactions = [];
        const usedTransactionIDs = [];

        // eslint-disable-next-line no-plusplus
        for (var i = 0; i < traversal.length; i++) {
            const point = traversal[i];
            if (point.vertex_type === 'BATCH' && usedBatchUIDs[point.identifiers.uid] !== true) {
                var edges = point.outbound;

                for (const j in edges) {
                    if (edges[j].edge_type === 'INSTANCE_OF') {
                        point.product_info = virtual_graph_data[edges[j].to];
                    } else if (edges[j].edge_type === 'OUTPUT_BATCH' || edges[j].edge_type === 'OF_BATCH') {
                        const event = virtual_graph_data[edges[j].to];
                        var event_edges = event.outbound;

                        for (i in event_edges) {
                            if (event_edges[i].edge_type === 'AT') {
                                point.location = virtual_graph_data[event_edges[i].to];
                            }
                        }
                    }
                }

                usedBatchUIDs[point.identifiers.uid] = true;
                batches.push(point);
            }

            if (point.vertex_type === 'TRANSACTION' && usedTransactionIDs[point.identifiers.TransactionId] !== true) {
                // eslint-disable-next-line no-redeclare
                var edges = point.outbound;

                usedTransactionIDs[point.identifiers.TransactionId] = true;
                transactions.push(point);
            }
        }
        // eslint-disable-next-line no-redeclare
        var i = 1;
        var j = 0;

        if (batches.length > 0) {
            journey.push(batches[0]);
        }

        while (i < batches.length && j < transactions.length) {
            // eslint-disable-next-line no-plusplus
            journey.push(transactions[j++]);
            // eslint-disable-next-line no-plusplus
            journey.push(batches[i++]);
        }

        if (i < batches.length) {
            journey.push(batches[i]);
        }

        return journey;
    }


    const product = {

        // Get trail by custom query
        // =========================
        getTrail(queryObject, callback) {
            let restricted = false;

            if (queryObject.restricted !== undefined) {
                // eslint-disable-next-line  prefer-destructuring
                restricted = queryObject.restricted;
                // eslint-disable-next-line no-param-reassign
                delete queryObject.restricted;
            }

            graph.getVertices(queryObject, (vertices) => {
                if (vertices.length === 0) {
                    utilities.executeCallback(callback, []);
                    return;
                }

                const start_vertex = vertices[0];

                graph.getTraversal(start_vertex, (raw_graph_data) => {
                    // eslint-disable-next-line max-len
                    const virtual_graph_data = graph.convertToVirtualGraph(utilities.copyObject(raw_graph_data));

                    // eslint-disable-next-line max-len
                    const returnBFS = utilities.copyObject(virtual_graph_data);
                    // eslint-disable-next-line max-len
                    const BFSt = graph.BFS(utilities.copyObject(returnBFS.data), start_vertex.identifiers.uid, true);

                    for (var i in BFSt) {
                        if (BFSt[i].outbound !== undefined) {
                            delete BFSt[i].outbound;
                        }
                    }

                    // Sorting keys in object for uniform response
                    // eslint-disable-next-line no-redeclare
                    for (var i in BFSt) {
                        BFSt[i] = utilities.sortObject(BFSt[i]);
                    }

                    // eslint-disable-next-line max-len
                    const BFS = graph.BFS(utilities.copyObject(virtual_graph_data.data), start_vertex.identifiers.uid, restricted);
                    // eslint-disable-next-line max-len
                    const BFS_data = utilities.copyObject(graph.BFS(virtual_graph_data.data, start_vertex.identifiers.uid, restricted));
                    // eslint-disable-next-line max-len
                    const fetchedJourney = getProductJourney(utilities.copyObject(virtual_graph_data.data), utilities.copyObject(BFS));


                    const responseObject = {
                        graph: virtual_graph_data.data,
                        traversal: BFSt,
                        journey: fetchedJourney,
                        sha3: utilities.sha3(JSON.stringify(BFSt)),
                    };

                    utilities.executeCallback(callback, responseObject);
                });
            });
        },
        // =========================

        getTrailByUID(batch_uid, callback) {
            const queryObject = {
                uid: batch_uid,
                vertex_type: 'BATCH',
            };

            this.getTrail(queryObject, callback);
        },

        getTrailByQuery(queryObject, callback) {
            // eslint-disable-next-line no-param-reassign
            queryObject.vertex_type = 'BATCH';

            this.getTrail(queryObject, callback);
        },

        hashTrail(trail, start_vertex_uid) {
            const BFStraversal = graph.BFS(trail, start_vertex_uid, true);

            for (var i in BFStraversal) {
                if (BFStraversal[i].outbound !== undefined) {
                    delete BFStraversal[i].outbound;
                }
            }
            // eslint-disable-next-line no-redeclare
            for (var i in BFStraversal) {
                BFStraversal[i] = utilities.sortObject(BFStraversal[i]);
            }

            const BFStraversalS = JSON.stringify(BFStraversal);

            // Import log entry
            fs.appendFile('import-log.txt', `\n\n-----------------\n UID: ${start_vertex_uid}\n\nUID hash: ${utilities.sha3(start_vertex_uid)}\n\nTraversal: ${BFStraversalS}\n\nTraversal hashed: ${utilities.sha3(BFStraversalS)}\n\n-----------------\n\n`, 'utf8', () => { });

            return utilities.sha3(BFStraversalS);
        },

    };

    return product;
};
