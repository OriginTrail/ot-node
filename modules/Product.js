const Utilities = require('./Utilities');
const ZK = require('./ZK');

/**
 * Encapsulates product related operations
 */
class Product {
    constructor(ctx) {
        this.graphStorage = ctx.graphStorage;
        this.ctx = ctx;
    }

    /**
     * Get vertex
     * @param queryObject
     * @returns {Promise}
     */
    getVertices(queryObject) {
        return new Promise((resolve, reject) => {
            this.graphStorage.findImportIds(queryObject).then((vertices) => {
                resolve(vertices);
            }).catch((err) => {
                reject(err);
            });
        });
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
                        resolve(virtualGraph.data);
                    }).catch((err) => {
                        reject(err);
                    });
            }).catch((error) => {
                reject(error);
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
        const zk = new ZK(this.ctx);

        for (const key in graph) {
            const vertex = graph[key];
            if (vertex.vertex_type === 'EVENT') {
                vertex.zk_status = this._calculateZeroKnowledge(
                    zk,
                    vertex.data.quantities.inputs,
                    vertex.data.quantities.outputs,
                    vertex.data.quantities.e,
                    vertex.data.quantities.a,
                    vertex.data.quantities.zp,
                );
            }
        }
        return virtualGraph;
    }

    /**
     * Calculate ZK proof
     */
    _calculateZeroKnowledge(zk, inputQuantities, outputQuantities, e, a, zp) {
        const inQuantities = inputQuantities.map(o => o.public.enc).sort();
        const outQuantities = outputQuantities.map(o => o.public.enc).sort();

        const z = zk.calculateZero(inQuantities, outQuantities);

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

    getImports(inputQuery) {
        return this.graphStorage.findImportIds(inputQuery);
    }
}

module.exports = Product;

