const { Database } = require('arangojs');
const request = require('superagent');
const Utilities = require('../Utilities');
const { normalizeGraph } = require('./graph-converter');

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
    constructor(username, password, database, host, port, log) {
        this.log = log;
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
     * Find set of documents with _key, vertex_type and identifiers values
     * @param queryObject       Query for getting documents
     * @returns {Promise<any>}
     */
    async findDocuments(collectionName, queryObject) {
        let queryString = `FOR v IN ${collectionName} `;
        const params = {};
        if (Utilities.isEmptyObject(queryObject) === false) {
            queryString += 'FILTER ';

            let count = 1;
            const filters = [];
            for (const key in queryObject) {
                if (key.match(/^[\w\d]+$/g) !== null) {
                    let searchKey;
                    if (key !== 'vertex_type' && key !== 'edge_type' && key !== '_key') {
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
     * Finds imports IDs based on data location query
     *
     * DataLocationQuery structure: [[path, value, opcode]*]
     *
     * @param {?number} encColor - Encrypted color (0=RED,1=GREEN,2=BLUE)
     * @param {object} dataLocationQuery - Search query
     * @return {Promise}
     */
    async findImportIds(dataLocationQuery, encColor = null) {
        const results = await this.dataLocationQuery(dataLocationQuery, encColor);
        if (results.length > 0) {
            return results[0].datasets;
        }
        return [];
    }

    async getConsensusEvents(sender_id) {
        const query = `FOR v IN ot_vertices
                       FILTER v.vertex_type == 'EVENT'
                       AND v.sender_id == @sender_id
                       AND v.encrypted == null
                       RETURN v`;

        const res = await this.runQuery(query, {
            sender_id,
        });

        const ownershipEvents = [];

        for (const event of res) {
            for (const key in event) {
                if (event[key].data) {
                    if (event[key].data.categories.indexOf('Ownership')) {
                        ownershipEvents.push({ side1: event });
                    }
                }
            }
        }

        const promises = [];

        for (const event of ownershipEvents) {
            const query = `FOR v, e IN 1..1 OUTBOUND @senderEventKey ot_edges
            FILTER e.edge_type == 'EVENT_CONNECTION'
            RETURN v`;
            promises.push(this.runQuery(query, { senderEventKey: `ot_vertices/${event.side1._key}` }));
        }

        const side2Vertices = await Promise.all(promises);

        for (const i in side2Vertices) {
            const side2Vertex = side2Vertices[i][0];
            ownershipEvents[i].side2 = side2Vertex;
        }

        return ownershipEvents;
    }


    /**
     * Finds vertices by query defined in DataLocationRequestObject
     * @param {?number} encColor - Encrypted color (0=RED,1=GREEN,2=BLUE)
     * @param inputQuery - Search query
     */
    async dataLocationQuery(inputQuery, encColor = null) {
        const params = {};

        let count = 1;
        let queryString = '';
        for (const searchRequestPart of inputQuery) {
            const { path, value, opcode } = searchRequestPart;

            if (opcode == null) {
                throw new Error('OPCODE parameter is not defined');
            }

            let id_type = path;

            if (path.indexOf('identifiers.') === 0) {
                id_type = id_type.replace('identifiers.', '');
            }

            const id_value = value;
            let filter = `LET v_res${count} = (
                                            FOR v${count} IN ot_vertices
                                        LET objects = (
                                            FOR w${count}, e IN 1..1
                                        OUTBOUND v${count}._id ot_edges
                                        FILTER e.edge_type == "IDENTIFIES"
                                        AND LENGTH(INTERSECTION(e.datasets, v${count}.datasets)) > 0
                                        AND v${count}.encrypted == ${encColor}
                                        RETURN w${count})
                             `;

            switch (opcode) {
            case 'EQ':
                filter += `FILTER v${count}.vertex_type == "IDENTIFIER"
                                     AND v${count}.id_type == @id_type${count}
                                     AND v${count}.id_value == @id_value${count}
                                     AND v${count}.encrypted == ${encColor}
                                     `;
                params[`id_type${count}`] = id_type;
                params[`id_value${count}`] = id_value;
                break;
            case 'IN':
                filter += `FILTER v${count}.vertex_type == "IDENTIFIER"
                                     AND v${count}.id_type == @id_type${count}
                                     AND  @id_value${count} IN v${count}.id_value
                                     AND v${count}.encrypted == ${encColor}
                                     `;

                params[`id_type${count}`] = id_type;
                params[`id_value${count}`] = id_value;
                break;
            default:
                throw new Error(`OPCODE ${opcode} is not defined`);
            }

            filter += `RETURN {"datasets": v${count}.datasets, "objects": objects})
                `;

            queryString += filter;

            count += 1;
        }

        for (let i = 1; i < count; i += 1) {
            queryString += `
                    FILTER LENGTH(v_res${i}) > 0
                    `;
        }


        queryString += ' RETURN {datasets: INTERSECTION(v_res1[0].datasets';

        for (let i = 1; i < count; i += 1) {
            queryString += `, v_res${i}[0].datasets`;
        }

        queryString += '), objects: INTERSECTION(v_res1[0].objects';

        for (let i = 1; i < count; i += 1) {
            queryString += `, v_res${i}[0].objects`;
        }
        queryString += ')}';

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
        const queryString = `let vertices = (FOR v, e, p IN 0..${depth} OUTBOUND 'ot_vertices/${startVertex._key}' ot_edges
                                OPTIONS {
                                    bfs: true,
                                    uniqueVertices: 'global',
                                    uniqueEdges: 'path'
                                }
                                FILTER p.vertices[*].vertex_type ALL != 'CLASS'
                                FILTER p.edges[*].edge_type ALL != 'IDENTIFIES'
                                RETURN v)
                                
                            let edges = (FOR v, e, p IN 0..${depth} OUTBOUND 'ot_vertices/${startVertex._key}' ot_edges
                                OPTIONS {
                                    bfs: true,
                                    uniqueVertices: 'global',
                                    uniqueEdges: 'path'
                                }
                                FILTER p.vertices[*].vertex_type ALL != 'CLASS'
                                FILTER p.edges[*].edge_type ALL != 'IDENTIFIES'
                                RETURN e)
                            RETURN {vertices, edges}`;

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
                    ArangoJS._normalizeConnection(edge);

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
        if (result.datasets !== undefined) {
            new_imports = result.datasets;

            if (new_imports.includes(importNumber)) {
                return result;
            }
        }

        new_imports.push(importNumber);

        result.datasets = new_imports;
        return this.updateDocument(collectionName, result);
    }

    /**
     * Removes hanging data set ID
     * @param dataSetID
     * @returns {Promise<any>}
     */
    async removeDataSetId(dataSetID) {
        const queryString = 'LET documents = (' +
            '    FOR d IN __COLLECTION__' +
            '    FILTER' +
            '        d.datasets != null' +
            '        AND' +
            '        POSITION(d.datasets, @dataSetID, false) != false' +
            '    SORT d._key RETURN d' +
            ')' +
            'RETURN COUNT(\n' +
            '    FOR d IN documents\n' +
            '        LET pos = POSITION(d.datasets, @dataSetID, true)\n' +
            '        LET dataSets = REMOVE_NTH(d.datasets, pos)\n' +
            '        UPDATE { _key: d._key, datasets: dataSets } IN __COLLECTION__\n' +
            '        RETURN 1)';

        const edgesQuery = queryString.replace(/__COLLECTION__/g, 'ot_edges');
        const verticesQuery = queryString.replace(/__COLLECTION__/g, 'ot_vertices');
        const params = {
            dataSetID,
        };
        let count = await this.runQuery(edgesQuery, params);
        count += await this.runQuery(verticesQuery, params);
        return count;
    }

    /**
     * Replaces one data set ID with another
     * @param oldDataSet    Old data set ID
     * @param newDataSet    New data set ID
     * @returns {Promise<any>}
     */
    async replaceDataSets(oldDataSet, newDataSet) {
        const queryString = 'LET documents = (' +
            '    FOR d IN __COLLECTION__' +
            '    FILTER' +
            '        d.datasets != null' +
            '        AND' +
            '        POSITION(d.datasets, @oldDataSet, false) != false' +
            '    SORT d._key RETURN d' +
            ')' +
            '    RETURN COUNT(' +
            '       FOR d IN documents' +
            '           LET pos = POSITION(d.datasets, @oldDataSet, true)' +
            '           LET dataSets = pos == -1? d.datasets : APPEND(PUSH(SLICE(d.datasets, 0, pos), @newDataSet), SLICE(d.datasets, pos+1))' +
            '           UPDATE { _key: d._key, datasets: dataSets } IN __COLLECTION__' +
            '       RETURN 1)';

        const edgesQuery = queryString.replace(/__COLLECTION__/g, 'ot_edges');
        const verticesQuery = queryString.replace(/__COLLECTION__/g, 'ot_vertices');
        const params = {
            oldDataSet,
            newDataSet,
        };
        let count = await this.runQuery(edgesQuery, params);
        count += await this.runQuery(verticesQuery, params);
        return count;
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
        if (result.datasets !== undefined) {
            new_imports = result.datasets;

            if (new_imports.includes(importNumber)) {
                return ArangoJS._normalize(result);
            }
        }

        new_imports.push(importNumber);

        result.datasets = new_imports;
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
            'FILTER v.uid == @uid AND v.sender_id == @senderId ' +
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
        const all = await result.all();
        return ArangoJS._normalize(all);
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
        const _edge = Utilities.copyObject(edge);
        _edge._from = `ot_vertices/${edge._from}`;
        _edge._to = `ot_vertices/${edge._to}`;
        return this.addDocument('ot_edges', _edge);
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
        if (document._key) {
            const response = await this.findDocuments(collectionName, { _key: document._key });
            if (response.length > 0) {
                const existing = ArangoJS._normalize(response[0]);
                Object.assign(existing, document);
                return this.updateDocument(collectionName, existing);
            }
        }
        return ArangoJS._normalize(await collection.save(document));
    }

    /**
     * Update document in ArangoDB graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    async updateDocument(collectionName, document) {
        ArangoJS._deNormalizeConnection(document);
        const collection = this.db.collection(collectionName);
        const response = await collection.update(document._key, document);
        return ArangoJS._normalize(response);
    }

    /**
     * Get document from ArangoDB graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    async getDocument(collectionName, documentKey) {
        const collection = this.db.collection(collectionName);
        const response = await collection.document(documentKey);
        return ArangoJS._normalize(response);
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

    /**
     * Gets the count of documents in collection.
     * @param collectionName
     */
    async getDocumentsCount(collectionName) {
        if (collectionName === undefined || collectionName === null) { throw Error('ArangoError: invalid collection name'); }
        const collection = this.db.collection(collectionName);
        try {
            const data = await collection.count();
            return data.count;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Finds vertices by dataset ID
     * @param {string} data_id - Dataset ID
     * @param {?number} encColor - Encrypted color (0=RED,1=GREEN,2=BLUE)
     * @return {Promise<*>}
     */
    async findVerticesByImportId(data_id, encColor = null) {
        const queryString = `FOR v IN ot_vertices 
                            FILTER v.datasets != null 
                            AND POSITION(v.datasets, @importId, false)  != false 
                            AND (v.encrypted == ${encColor})
                            SORT v._key RETURN v`;

        const params = { importId: data_id };
        const vertices = await this.runQuery(queryString, params);

        const normalizedVertices = normalizeGraph(data_id, vertices, []).vertices;

        if (normalizedVertices.length === 0) {
            return [];
        }

        // Check if packed to fix issue with double classes.
        const filtered = normalizedVertices.filter(v => v._dc_key);
        if (filtered.length > 0) {
            return normalizedVertices;
        }

        const objectClasses = await this.findObjectClassVertices();

        return normalizedVertices.concat(objectClasses);
    }

    /**
     * Finds object vertices.
     * TODO We need to change the query. This is not the appropriate way.
     * @return {Promise<any>}
     */
    async findObjectClassVertices() {
        const queryString = 'FOR v IN ot_vertices ' +
            'FILTER v.vertex_type == "CLASS" ' +
            'AND v.datasets == null ' +
            'AND v._dc_key == null ' +
            'SORT v._key ' +
            'RETURN v';
        return this.runQuery(queryString, {});
    }

    /**
     * Find edges by dataset ID
     * @param {string} data_id - Dataset ID
     * @param {?number} encColor - Encrypted color (0=RED,1=GREEN,2=BLUE)
     * @return {Promise<void>}
     */
    async findEdgesByImportId(data_id, encColor = null) {
        const queryString = 'FOR v IN ot_edges ' +
                'FILTER v.datasets != null ' +
                'AND POSITION(v.datasets, @importId, false) != false ' +
                `AND v.encrypted == ${encColor} ` +
                'SORT v._key ' +
                'RETURN v';

        const params = { importId: data_id };
        const edges = await this.runQuery(queryString, params);
        return normalizeGraph(data_id, [], edges).edges;
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
        // 'FILTER v.identifiers.document_id == @documentId
        // AND @senderId in v.partner_id AND v.sender_id in @partnerId ' +
        //  'RETURN v';

        const queryString = `FOR v IN ot_vertices
            FILTER v.vertex_type == 'EVENT' and v.encrypted == null
            RETURN v`;
        const params = {};
        const result = await this.runQuery(queryString, params);

        return result.filter((event) => {
            if (partnerId.indexOf(event.sender_id) !== -1) {
                for (const key in event) {
                    if (event[key].data) {
                        const { data } = event[key];

                        if (data.bizStep
                            && data.bizStep.endsWith(bizStep)
                            && data.extension
                            && data.extension.extension
                            && data.extension.extension.documentId === documentId) {
                            return true;
                        }
                    }
                }
            }
            return false;
        });
    }

    /**
     * Mimics commit opertaion
     * Removes inTransaction fields
     * @return {Promise<void>}
     */
    async commit() {
        const queryUpdateTemplate = 'FOR v IN __COLLECTION__ ' +
            'FILTER v.inTransaction == true ' +
            'UPDATE v WITH { inTransaction: null } ' +
            'IN __COLLECTION__ OPTIONS { keepNull: false } ' +
            'RETURN NEW';

        await this.runQuery(queryUpdateTemplate.replace(/__COLLECTION__/g, 'ot_vertices'));
        await this.runQuery(queryUpdateTemplate.replace(/__COLLECTION__/g, 'ot_edges'));
    }

    /**
     * Mimics rollback opertaion
     * Removes elements in transaction
     * @return {Promise<void>}
     */
    async rollback() {
        let queryString = 'FOR v IN ot_vertices FILTER v.inTransaction == true REMOVE v IN ot_vertices';
        await this.runQuery(queryString);
        queryString = 'FOR e IN ot_edges FILTER e.inTransaction == true REMOVE e IN ot_edges';
        await this.runQuery(queryString);
    }

    /**
     * Normalize properties returned from ArangoDB
     * @param document
     * @returns {*}
     * @private
     */
    static _normalize(document) {
        if (Array.isArray(document)) {
            for (const doc of document) {
                ArangoJS._normalize(doc);
            }
        } else {
            delete document._id;
            delete document._rev;
            delete document._oldRev;
            ArangoJS._normalizeConnection(document);
        }
        return document;
    }

    /**
     * Removes collection name from document properties
     * @param document
     * @returns {*}
     * @private
     */
    static _normalizeConnection(document) {
        if (typeof document._from === 'string' && document._from.startsWith('ot_vertices/')) {
            document._from = document._from.substring('ot_vertices/'.length);
        }
        if (typeof document._to === 'string' && document._to.startsWith('ot_vertices/')) {
            document._to = document._to.substring('ot_vertices/'.length);
        }
        return document;
    }

    /**
     * Adds collection name to document properties
     * @param document
     * @returns {*}
     * @private
     */
    static _deNormalizeConnection(document) {
        if (typeof document._from === 'string' && !document._from.startsWith('ot_vertices/')) {
            document._from = `ot_vertices/${document._from}`;
        }
        if (typeof document._to === 'string' && !document._to.startsWith('ot_vertices/')) {
            document._to = `ot_vertices/${document._to}`;
        }
        return document;
    }
}
module.exports = ArangoJS;
