const { Database } = require('arangojs');
const Utilities = require('./../Utilities');

const log = Utilities.getLogger();
const IGNORE_DOUBLE_INSERT = true;

class ArangoJS {
    /**
     * Creates new object connected with ArangoDB database,
     * with connection data found in system database
     * @constructor
     * @param {string} - username
     * @param {string} - password
     * @param {string} - database
     * @param {string} - host
     * @param {number} - port
     */
    constructor(username, password, database, host, port) {
        this.db = new Database(`http://${host}:${port}`);
        this.db.useDatabase(database);
        this.db.useBasicAuth(username, password);
    }

    /**
     * Initialize database
     * @return {Promise<void>}
     */
    async initialize(allowedClasses) {
        await this.createCollection('ot_vertices');
        await this.createEdgeCollection('ot_edges');

        await Promise.all(allowedClasses.map(className => this.addVertex({
            _key: className,
            vertex_type: 'CLASS',
        })));
    }

    /**
     * Find set of vertices
     * @param queryObject       Query for getting vertices
     * @returns {Promise<any>}
     */
    async findVertices(queryObject) {
        let queryString = 'FOR v IN ot_vertices ';
        const params = {};
        if (Utilities.isEmptyObject(queryObject) === false) {
            queryString += 'FILTER ';

            let count = 1;
            const filters = [];
            for (const key in queryObject) {
                if (key.match(/^[\w\d]+$/g) !== null) {
                    let searchKey;
                    if (key !== 'vertex_type' && key !== '_key') {
                        searchKey = `identifiers.${key}`;
                    } else {
                        searchKey = key;
                    }
                    const param = `param${count}`;
                    filters.push(`v.${searchKey} == @param${count}`);

                    count += 1;
                    params[param] = queryObject[key];
                }
            }
            queryString += filters.join(' AND ');
        }
        queryString += ' RETURN v';
        return this.runQuery(queryString, params);
    }

    /**
     * Finds traversal path starting from particular vertex
     * @param startVertex       Starting vertex
     * @param depth             Explicit traversal depth
     * @returns {Promise<any>}
     */
    async findTraversalPath(startVertex, depth) {
        if (startVertex === undefined || startVertex._id === undefined) {
            return [];
        }
        if (depth == null) {
            depth = this.getDatabaseInfo().max_path_length;
        }
        const queryString = `FOR vertice, edge, path IN 1 .. ${depth}
            OUTBOUND '${startVertex._id}'
            GRAPH 'origintrail_graph'
            RETURN path`;

        return ArangoJS.convertToVirtualGraph(await this.runQuery(queryString));
    }

    /**
     * Transforms raw graph data to virtual one (without
     * @param rawGraph  Raw graph structure
     * @returns {{}}
     */
    static convertToVirtualGraph(rawGraph) {
        const resultList = {};
        const resultEdges = {};
        const resultVertices = {};

        for (const id in rawGraph) {
            const graph = rawGraph[id];
            if (graph.edges == null) {
                // eslint-disable-next-line no-continue
                continue;
            }

            for (const edgeId in graph.edges) {
                const edge = graph.edges[edgeId];
                if (edge !== null) {
                    edge.key = edge._key;
                    // eslint-disable-next-line no-underscore-dangle,prefer-destructuring
                    edge.from = edge._from.split('/')[1];
                    // eslint-disable-next-line no-underscore-dangle,prefer-destructuring
                    edge.to = edge._to.split('/')[1];

                    delete edge._key;
                    delete edge._id;
                    delete edge._rev;
                    delete edge._to;
                    delete edge._from;

                    // eslint-disable-next-line  prefer-destructuring
                    const key = edge.key;
                    if (resultEdges[key] === undefined) {
                        resultEdges[key] = edge;
                    }
                }
            }

            if (graph.vertices !== undefined) {
                for (const vertexId in graph.vertices) {
                    const vertex = graph.vertices[vertexId];
                    if (vertex !== null) {
                        vertex.key = vertex._key;
                        vertex.outbound = [];

                        delete vertex._key;
                        delete vertex._id;
                        delete vertex._rev;

                        // eslint-disable-next-line  prefer-destructuring
                        const key = vertex.key;
                        if (resultVertices[key] === undefined) {
                            resultVertices[key] = vertex;
                        }
                    }
                }
            }
        }

        for (const vertexId in resultVertices) {
            resultList[resultVertices[vertexId].key] = resultVertices[vertexId];
        }
        for (const edgeId in resultEdges) {
            resultList[resultEdges[edgeId].from].outbound.push(resultEdges[edgeId]);
        }
        return {
            data: resultList,
        };
    }

    async updateImports(collectionName, document, importNumber) {
        const result = await this.getDocument(collectionName, document);
        let new_imports = [];
        if (result.imports !== undefined) {
            new_imports = result.imports;

            if (new_imports.includes(importNumber)) {
                return result;
            }
        }

        new_imports.push(importNumber);

        result.imports = new_imports;
        return this.updateDocument(collectionName, result);
    }

    /**
     * Gets max version where uid is the same but not the _key
     * @param uid   Vertex uid
     * @param _key  Vertex _key
     * @return {Promise<void>}
     */
    async findMaxVersion(uid, _key) {
        const queryString = 'FOR v IN ot_vertices ' +
                'FILTER v.identifiers.uid == @uid AND AND v._key != @_key ' +
                'SORT v.version DESC ' +
                'LIMIT 1 ' +
                'RETURN v.version';
        const params = {
            uid,
            _key,
        };
        return this.runQuery(queryString, params);
    }

    /**
     * Gets max where uid is the same and has the max version
     * @param uid   Vertex uid
     * @return {Promise<void>}
     */
    async findVertexWithMaxVersion(uid) {
        const queryString = 'FOR v IN ot_vertices ' +
                'FILTER v.identifiers.uid == @uid ' +
                'SORT v.version DESC ' +
                'LIMIT 1 ' +
                'RETURN v';
        const params = {
            uid,
        };

        const result = await this.runQuery(queryString, params);
        if (result.length > 0) {
            return result[0];
        }
        return null;
    }

    /**
     * Run query on ArangoDB graph database
     * @param {string} - queryString
     * @param {object} - params
     * @returns {Promise<any>}
     */
    async runQuery(queryString, params) {
        const result = await this.db.query(queryString, params);
        return result.all();
    }

    /**
     * Inserts vertex into ArangoDB graph database
     * @param {vertex} - document
     * @returns {Promise<any>}
     */
    async addVertex(vertex) {
        return this.addDocument('ot_vertices', vertex);
    }

    /**
     * Inserts edge into ArangoDB graph database
     * @param {vertex} - document
     * @returns {Promise<any>}
     */
    async addEdge(edge) {
        return this.addDocument('ot_edges', edge);
    }

    /**
     * Inserts document into ArangoDB graph database for given collection name
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    async addDocument(collectionName, document) {
        const collection = this.db.collection(collectionName);
        try {
            return await collection.save(document);
        } catch (err) {
            const errorCode = err.response.body.code;
            if (errorCode === 409 && IGNORE_DOUBLE_INSERT) {
                return 'Double insert';
            }
            throw err;
        }
    }

    /**
     * Update document in ArangoDB graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    async updateDocument(collectionName, document) {
        const collection = this.db.collection(collectionName);
        return collection.update(document._key, document);
    }

    /**
     * Get document from ArangoDB graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    async getDocument(collectionName, documentKey) {
        const collection = this.db.collection(collectionName);
        return collection.document(documentKey);
    }


    /**
     * Identify selected database as ArangoJS
     * @returns {string} - Graph database identifier string
     */
    identify() {
        return 'ArangoJS';
    }

    /**
     * Create document collection, if collection does not exist
     * @param collectionName
     */
    async createCollection(collectionName) {
        const collection = this.db.collection(collectionName);
        try {
            await collection.create();
            return 'Collection created';
        } catch (err) {
            const errorCode = err.response.body.code;
            if (errorCode === 409 && IGNORE_DOUBLE_INSERT) {
                return 'Double insert';
            }
            throw err;
        }
    }

    async createEdgeCollection(collectionName) {
        const collection = this.db.edgeCollection(collectionName);
        try {
            await collection.create();
            return 'Edge collection created';
        } catch (err) {
            const errorCode = err.response.body.code;
            if (errorCode === 409 && IGNORE_DOUBLE_INSERT) {
                return 'Double insert';
            }
            throw err;
        }
    }

    async findVerticesByImportId(data_id) {
        const queryString = 'FOR v IN ot_vertices FILTER POSITION(v.imports, @importId, false) != false SORT v._key RETURN v';

        if (typeof data_id !== 'number') {
            data_id = parseInt(data_id, 10);
        }

        const params = { importId: data_id };
        return this.runQuery(queryString, params);
    }

    async findEdgesByImportId(data_id) {
        const queryString = 'FOR v IN ot_edges FILTER POSITION(v.imports, @importId, false) != false SORT v._key RETURN v';

        if (typeof data_id !== 'number') {
            data_id = parseInt(data_id, 10);
        }

        const params = { importId: data_id };
        return this.runQuery(queryString, params);
    }
}

module.exports = ArangoJS;
