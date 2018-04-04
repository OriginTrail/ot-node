class Graph {
    /**
     * Traversing through the trail graph in Breadth-first manner
     * @param {object}  - trailGraph
     * @param {string}  - startVertexUID
     * @param {boolean} - restrictToOneBatch
     * @returns {Array} - traversal path
     */
    static bfs(trailGraph, startVertexUID, restrictToOneBatch = false) {
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

                    // don't follow output flow
                    if (edge.edge_type === 'TRANSACTION_CONNECTION' && edge.TransactionFlow === 'Output') {
                        // eslint-disable-next-line no-continue
                        continue; // don't follow output edges
                    }

                    if (restrictToOneBatch === false || (toVertex.vertex_type !== 'BATCH' && edge.edge_type !== 'TRANSACTION_CONNECTION')) {
                        visitedIds[toVertexId] = true;
                        queueToExplore.push(toVertexId);
                    }
                }
            }
        }
        return traversalPath;
    }
}

module.exports = Graph;
