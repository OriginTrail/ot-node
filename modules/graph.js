class Graph {

    /**
     * Traversing through the trail graph in Breadth-first manner
     */
    static bfs(trail, start_vertex_uid, restricted = false) {
        const visited = [];
        const traversalArray = [];

        let start_vertex = null;

        for (const i in trail) {
            if (trail[i].identifiers.uid === start_vertex_uid) {
                start_vertex = i;
                break;
            }
        }

        if (start_vertex !== null) {
            const queue = [];
            queue.push(start_vertex);

            visited[start_vertex] = true;

            while (queue.length > 0) {
                const curr = queue.shift();

                if (trail[curr] === undefined) {
                    // eslint-disable-next-line no-continue
                    continue;
                }

                traversalArray.push(trail[curr]);

                for (const i in trail[curr].outbound) {
                    const e = trail[curr].outbound[i];
                    const w = e.to;

                    if (restricted && e.edge_type !== 'TRANSACTION_CONNECTION') {
                        traversalArray.push(e);
                    }

                    if (visited[w] === undefined && trail[w] !== undefined && !(e.edge_type === 'TRANSACTION_CONNECTION' && e.TransactionFlow === 'Output') && (restricted === false || (restricted === true && trail[w].vertex_type !== 'BATCH' && e.edge_type !== 'TRANSACTION_CONNECTION'))) {
                        visited[w] = true;
                        queue.push(w);
                    }
                }
            }

            for (const i in traversalArray) {
                // eslint-disable-next-line no-underscore-dangle
                if (traversalArray[i]._checked !== undefined) {
                    // eslint-disable-next-line no-underscore-dangle
                    delete traversalArray[i]._checked;
                }
            }

            return traversalArray;
        }
        return traversalArray;
    }
}

module.exports = Graph;
