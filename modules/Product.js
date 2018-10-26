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
    }

    /**
     * Get vertex
     * @param queryObject
     * @returns {Promise}
     */
    getVertices(queryObject) {
        return new Promise((resolve, reject) => {
            const validationError = ObjectValidator.validateSearchQueryObject(queryObject);
            if (validationError) {
                reject(validationError);
            }
            this.graphStorage.findImportIds(queryObject).then((vertices) => {
                resolve(vertices);
            }).catch((err) => {
                reject(err);
            });
        });
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
                if (response[0].objects.length === 0) {
                    resolve([]);
                    return;
                }

                const responseData = [];
                const depth = this.graphStorage.getDatabaseInfo().max_path_length;

                for (const start_vertex of response[0].objects) {
                    // eslint-disable-next-line
                   const virtualGraph = await this.graphStorage.findTraversalPath(start_vertex, depth);
                    responseData.push({
                        start: start_vertex._key,
                        data: virtualGraph.data,
                    });
                }
                resolve(responseData);
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

    async getImports(inputQuery) {
        const validationError = ObjectValidator.validateSearchQueryObject(inputQuery);
        if (validationError) {
            throw validationError;
        }
        return this.graphStorage.findImportIds(inputQuery);
    }
}

module.exports = Product;

