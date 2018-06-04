const { Database } = require('arangojs');
const Utilities = require('./../Utilities');
const request = require('superagent');

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
     * Find set of vertices with _key, vertex_type and identifiers values
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
        if (startVertex === undefined || startVertex._key === undefined) {
            return [];
        }
        const queryString = `FOR vertex, edge, path
            IN 1 .. ${depth}
            OUTBOUND 'ot_vertices/${startVertex._key}'
            ot_edges
            RETURN path`;

        const rawGraph = await this.runQuery(queryString);
        return ArangoJS.convertToVirtualGraph(rawGraph);
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
                    // eslint-disable-next-line no-underscore-dangle,prefer-destructuring
                    edge._from = edge._from.split('/')[1];
                    // eslint-disable-next-line no-underscore-dangle,prefer-destructuring
                    edge._to = edge._to.split('/')[1];

                    delete edge._id;
                    delete edge._rev;

                    // eslint-disable-next-line  prefer-destructuring
                    const key = edge._key;
                    if (resultEdges[key] === undefined) {
                        resultEdges[key] = edge;
                    }
                }
            }

            if (graph.vertices !== undefined) {
                for (const vertexId in graph.vertices) {
                    const vertex = graph.vertices[vertexId];
                    if (vertex !== null) {
                        vertex.outbound = [];

                        delete vertex._id;
                        delete vertex._rev;

                        // eslint-disable-next-line  prefer-destructuring
                        const key = vertex._key;
                        if (resultVertices[key] === undefined) {
                            resultVertices[key] = vertex;
                        }
                    }
                }
            }
        }

        for (const vertexId in resultVertices) {
            resultList[resultVertices[vertexId]._key] = resultVertices[vertexId];
        }
        for (const edgeId in resultEdges) {
            resultList[resultEdges[edgeId]._from].outbound.push(resultEdges[edgeId]);
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
     * Updates document imports by ID
     * @param collectionName
     * @param senderId
     * @param uid
     * @param importNumber
     * @return {Promise<*>}
     */
    async updateDocumentImportsByUID(collectionName, senderId, uid, importNumber) {
        const result = await this.findDocumentWithMaxVersion(collectionName, senderId, uid);
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
     * Updates vertex imports by ID
     * @param senderId
     * @param uid
     * @param importNumber
     * @return {Promise<*>}
     */
    async updateVertexImportsByUID(senderId, uid, importNumber) {
        return this.updateDocumentImportsByUID('ot_vertices', senderId, uid, importNumber);
    }

    /**
     * Updates edge imports by ID
     * @param senderId
     * @param uid
     * @param importNumber
     * @return {Promise<*>}
     */
    async updateEdgeImportsByUID(senderId, uid, importNumber) {
        return this.updateDocumentImportsByUID('ot_edges', senderId, uid, importNumber);
    }

    /**
     * Gets max where uid is the same and has the max version
     * @param senderId  Sender ID
     * @param uid       Vertex uid
     * @return {Promise<void>}
     */
    async findVertexWithMaxVersion(senderId, uid) {
        return this.findDocumentWithMaxVersion('ot_vertices', senderId, uid);
    }

    /**
     * Gets max where uid is the same and has the max version
     * @param senderId  Sender ID
     * @param uid       Vertex uid
     * @return {Promise<void>}
     */
    async findEdgeWithMaxVersion(senderId, uid) {
        return this.findDocumentWithMaxVersion('ot_edges', senderId, uid);
    }

    /**
     * Gets max where uid is the same and has the max version
     * @param senderId   Sender ID
     * @param uid        Vertex uid
     * @param collection Collection name
     * @return {Promise<void>}
     */
    async findDocumentWithMaxVersion(collection, senderId, uid) {
        const queryString = `FOR v IN  ${collection} ` +
            'FILTER v.identifiers.uid == @uid AND v.sender_id == @senderId ' +
            'SORT v.version DESC ' +
            'LIMIT 1 ' +
            'RETURN v';
        const params = {
            uid,
            senderId,
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
        if (document === undefined || document === null) { throw Error('ArangoError: invalid document type'); }
        if (collectionName === undefined || collectionName === null) { throw Error('ArangoError: invalid collection type'); }

        const collection = this.db.collection(collectionName);
        if (document.sender_id && document.identifiers && document.identifiers.uid) {
            const maxVersionDoc =
                await this.findDocumentWithMaxVersion(
                    collectionName,
                    document.sender_id,
                    document.identifiers.uid,
                );

            if (maxVersionDoc) {
                if (maxVersionDoc._key === document._key) {
                    return maxVersionDoc;
                }

                document.version = maxVersionDoc.version + 1;
                return collection.save(document);
            }

            document.version = 1;
            return collection.save(document);
        }
        try {
            // First check if already exist.
            const dbVertex = await this.getDocument(collectionName, document);
            return dbVertex;
        } catch (ignore) {
            return collection.save(document);
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
    * Get ArangoDB version
    * @param {string} - host
    * @param {string} - port
    * @param {string} - username
    * @param {string} - password
    * @returns {Promise<any>}
    */
    async version(host, port, username, password) {
        const result = await request
            .get(`http://${host}:${port}/_api/version`)
            .auth(username, password);

        try {
            if (result.status === 200) {
                return result.body.version;
            }
        } catch (error) {
            throw Error(`Failed to contact arangodb${error}`);
        }
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

    /**
     * Deletes the collection in the database.
     * @param collectionName
     */
    async dropCollection(collectionName) {
        if (collectionName === undefined || collectionName === null) { throw Error('ArangoError: invalid collection type'); }
        const collection = this.db.collection(collectionName);
        try {
            await collection.drop();
            return 'Collection is now deleted';
        } catch (err) {
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
        const queryString = 'FOR v IN ot_edges FILTER v.imports != null and POSITION(v.imports, @importId, false) != false SORT v._key RETURN v';

        if (typeof data_id !== 'number') {
            data_id = parseInt(data_id, 10);
        }

        const params = { importId: data_id };
        return this.runQuery(queryString, params);
    }

    /**
     * Find event based on ID and bizStep
     * Note: based on bizStep we define INPUT(shipping) or OUTPUT(receiving)
     * @param senderId      Sender ID
     * @param partnerId     Partner ID
     * @param documentId    Document ID
     * @param bizStep       BizStep value
     * @return {Promise}
     */
    async findEvent(senderId, partnerId, documentId, bizStep) {
        const queryString = 'FOR v IN ot_vertices ' +
            'FILTER v.identifiers.document_id == @documentId AND @senderId in v.partner_id AND v.sender_id in @partnerId ' +
            'RETURN v';
        const params = {
            partnerId,
            documentId,
            senderId,
        };
        const result = await this.runQuery(queryString, params);
        return result.filter(event => event.data.bizStep && event.data.bizStep.endsWith(bizStep));
    }
}

module.exports = ArangoJS;
