const Utilities = require('./Utilities');
const ZK = require('./ZK');

const ObjectValidator = require('./validator/object-validator');

/**
 * Encapsulates product related operations
 */
class Product {
    constructor(ctx) {
        this.graphStorage = ctx.graphStorage;
        this.ctx = ctx;
        this.log = ctx.logger;
    }

    /**
     * Get vertex
     * @param queryObject
     * @returns {Promise}
     */
    getVertices(queryObject) {
    }


    convertToDataLocationQuery(query) {
        const dlQuery = [];
        for (const key in query) {
            dlQuery.push({
                path: key,
                value: query[key],
                opcode: 'EQ',
            });
        }

        return dlQuery;
    }

    /**
     * Gets trail based on query parameter map
     * @param queryObject   Query parameter map
     * @returns {Promise}
     */
    getTrail(queryObject) {
        return new Promise((resolve, reject) => {
            // if (queryObject.restricted !== undefined) {
            //     delete queryObject.restricted;
            // }

            const dlQuery = this.convertToDataLocationQuery(queryObject);

            this.graphStorage.dataLocationQuery(dlQuery).then(async (response) => {
                if (!response[0] || response[0].length === 0 || response[0].objects.length === 0) {
                    resolve([]);
                    return;
                }

                const responseData = [];
                const depth = this.graphStorage.getDatabaseInfo().max_path_length;

                for (const start_vertex of response[0].objects) {
                    // eslint-disable-next-line
                   const virtualGraph = this.zeroKnowledge(await this.graphStorage.findTraversalPath(start_vertex, depth));
                    const lastDatasetIndex = start_vertex.datasets.length - 1;
                    const datasetId = start_vertex.datasets[lastDatasetIndex];
                    responseData.push({
                        start: start_vertex._key,
                        batch: start_vertex[datasetId].data,
                        data: virtualGraph.data,
                    });
                }
                resolve(responseData);
            }).catch((error) => {
                this.log.error(error);
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
                const n = vertex.datasets.length;
                const latestDataset = vertex.datasets[n - 1];
                const results = [];

                for (const unit in vertex[latestDataset].data.quantities) {
                    results.push(this._calculateZeroKnowledge(
                        zk,
                        vertex[latestDataset].data.quantities[unit].inputs,
                        vertex[latestDataset].data.quantities[unit].outputs,
                        vertex[latestDataset].data.quantities[unit].e,
                        vertex[latestDataset].data.quantities[unit].a,
                        vertex[latestDataset].data.quantities[unit].zp,
                    ));
                }

                let passed = 0;
                let failed = 0;

                for (const res of results) {
                    if (res === 'PASSED') {
                        passed += 1;
                    } else {
                        failed += 1;
                    }
                }

                if (failed > 0) {
                    if (passed > 0) {
                        vertex.zk_status = 'PARTIAL';
                    } else {
                        vertex.zk_status = 'FAILED';
                    }
                } else {
                    vertex.zk_status = 'PASSED';
                }
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

    async getImports(inputQuery) {
        const validationError = ObjectValidator.validateSearchQueryObject(inputQuery);
        if (validationError) {
            throw validationError;
        }
        return this.graphStorage.findImportIds(inputQuery);
    }
}

module.exports = Product;

