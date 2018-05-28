const Graph = require('./Graph');
const Utilities = require('./Utilities');
const ZK = require('./ZK');

/**
 * Encapsulates product related operations
 */
class Product {
    constructor(ctx) {
        this.graphStorage = ctx.graphStorage;
    }

    /**
     * Gets trail based on query parameter map
     * @param queryObject   Query parameter map
     * @returns {Promise}
     */
    getTrail(queryObject) {
        return new Promise((resolve, reject) => {
            if (queryObject.restricted !== undefined) {
                delete queryObject.restricted;
            }

            this.graphStorage.findVertices(queryObject).then((vertices) => {
                if (vertices.length === 0) {
                    resolve([]);
                    return;
                }

                const start_vertex = vertices[0];
                const depth = this.graphStorage.getDatabaseInfo().max_path_length;
                this.graphStorage.findTraversalPath(start_vertex, depth)
                    .then((virtualGraph) => {
                        virtualGraph = this.consensusCheck(virtualGraph);
                        virtualGraph = this.zeroKnowledge(virtualGraph);
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

                        const responseObject = {
                            graph: virtualGraph.data,
                            traversal: BFSt,
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
                        const distance = Utilities.objectDistance(vertex.data, neighbour.data, ['quantities', 'bizStep']);
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
     * Go through the virtual graph and check zero knowledge proof
     * @param virtualGraph
     */
    zeroKnowledge(virtualGraph) {
        const graph = virtualGraph.data;
        const zk = new ZK();

        for (const key in graph) {
            const vertex = graph[key];
            if (vertex.vertex_type === 'EVENT') {
                for (const neighbourEdge of vertex.outbound) {
                    if (neighbourEdge.edge_type === 'EVENT_CONNECTION') {
                        const neighbour = graph[neighbourEdge.to];
                        const { bizStep } = vertex.data;
                        if (bizStep.endsWith('shipping')) {
                            vertex.zk_status = this._calculateZeroKnowledge(
                                zk,
                                vertex.data.quantities.outputs,
                                neighbour.data.quantities.inputs,
                                vertex.data.quantities.inputs,
                                vertex.data.quantities.e,
                                vertex.data.quantities.a,
                                vertex.data.quantities.zp,
                                false,
                            );
                        } else if (bizStep.endsWith('receiving')) {
                            vertex.zk_status = this._calculateZeroKnowledge(
                                zk,
                                vertex.data.quantities.inputs,
                                neighbour.data.quantities.outputs,
                                vertex.data.quantities.outputs,
                                vertex.data.quantities.e,
                                vertex.data.quantities.a,
                                vertex.data.quantities.zp,
                                true,
                            );
                        }
                    }
                }
            }
        }
        return virtualGraph;
    }

    /**
     * Calculate ZK proof
     */
    _calculateZeroKnowledge(zk, lQuantities, rQuantities, quantities, e, a, zp, isInput) {
        const lQuantitiesMapped = lQuantities.map(o => o.public.enc).sort();
        const nQuantitiesMapped = rQuantities.map(o => o.public.enc).sort();

        if (JSON.stringify(lQuantitiesMapped) !== JSON.stringify(nQuantitiesMapped)) {
            return 'FAILED';
        }
        const quantitiesMapped = quantities.map(o => o.public.enc);
        let z = null;
        if (isInput) {
            z = zk.calculateZero(lQuantitiesMapped, quantitiesMapped);
        } else {
            z = zk.calculateZero(quantitiesMapped, lQuantitiesMapped);
        }
        const valid = zk.V(
            e, a, z,
            zp,
        );
        if (!valid) {
            return 'FAILED';
        }
        return 'PASSED';
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
}

module.exports = Product;

