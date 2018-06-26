const neo4j = require('neo4j-driver').v1;
const Utilities = require('../Utilities');
const request = require('superagent');

const BN = require('bn.js');

/**
 * Neo4j storage adapter
 */
class Neo4jDB {
    /**
     * Neo4jDB constructor
     * @param username  Username
     * @param password  Password
     * @param database  Database name
     * @param host      Database connection host
     * @param port      Database connection port
     */
    constructor(username, password, database, host, port, log) {
        this.log = log;
        this.driver = neo4j.driver(`bolt://${host}:${port}`, neo4j.auth.basic(username, password));
    }

    /**
     * Initialize database
     * @return {Promise<void>}
     */
    async initialize(allowedClasses) {
        const session = this.driver.session();
        for (const className of allowedClasses) {
            // eslint-disable-next-line
            const previous = await session.readTransaction(tx => tx.run(`MATCH (n) where n._key = '${className}' return n`));
            if (previous.records.length === 0) {
                // eslint-disable-next-line
                await this.addVertex({
                    _key: className,
                    vertex_type: 'CLASS',
                });
            }
        }
        session.close();
    }

    /**
     * Get properties for Neo4J
     * @param obj           Extraction object
     * @param excludeList   List of excluded properties
     * @private
     */
    static _getParams(obj, excludeList) {
        const values = {};
        const queries = [];
        for (const p in obj) {
            if (obj[p] == null) {
                // eslint-disable-next-line
                continue;
            }
            let value = obj[p];
            if (obj[p] instanceof BN) {
                value = obj[p].toString();
            }
            let normParamKey = p;
            if (p.includes(':')) {
                normParamKey = `\`${p}\``;
            }
            if (typeof obj[p] !== 'object') {
                if (!excludeList || !excludeList.includes(p)) {
                    values[normParamKey] = value;
                    queries.push(`${normParamKey}:$${normParamKey}`);
                }
            } else if (Array.isArray(obj[p])) {
                const array = [];
                for (const item of obj[p]) {
                    if (typeof item === 'object' || Array.isArray(item)) {
                        array.push(JSON.stringify(item));
                    } else if (item instanceof BN) {
                        array.push(item.toString());
                    } else {
                        array.push(item);
                    }
                }
                if (!excludeList || !excludeList.includes(p)) {
                    values[normParamKey] = array;
                    queries.push(`${normParamKey}:$${normParamKey}`);
                }
            }
        }
        return {
            values,
            queries,
        };
    }

    /**
     * Get nested objects from object
     * @param obj           Extraction object
     * @returns {Array}     Array of nested objects
     * @private
     */
    static _getNestedObjects(obj) {
        const result = [];
        for (const p in obj) {
            if (typeof obj[p] === 'object' && !Array.isArray(obj[p]) && !(obj[p] instanceof BN)) {
                result.push({
                    edge: p,
                    subvalue: obj[p],
                });
            }
        }
        return result;
    }

    /**
     * Create vertex
     * @param value         Vertex document
     * @returns {Promise}
     */
    async addVertex(value) {
        const session = this.driver.session();
        const tx = session.beginTransaction();
        if (value == null || typeof value !== 'object' || Object.keys(value).length === 0) {
            throw new Error(`Invalid vertex ${JSON.stringify(value)}`);
        }

        if (value.sender_id && value.identifiers && value.identifiers.uid) {
            const maxVersionDoc =
                await this.findVertexWithMaxVersion(
                    value.sender_id,
                    value.identifiers.uid,
                );

            if (maxVersionDoc) {
                if (maxVersionDoc._key === value._key) {
                    return maxVersionDoc;
                }

                value.version = maxVersionDoc.version + 1;
                // return this._addVertex(value);
                const response = await this._addVertex(value, tx);
                await tx.commit();
                session.close();
                return response;
            }

            value.version = 1;
            // return this._addVertex(value);
            const response = await this._addVertex(value, tx);
            await tx.commit();
            session.close();
            return response;
        }
        // First check if already exist.
        const dbVertex = await this._fetchVertex('_key', value._key);

        if (dbVertex === {}) {
            return dbVertex;
        }
        // return this._addVertex(value);
        const response = await this._addVertex(value, tx);
        await tx.commit();
        session.close();
        return response;
    }
    /**
     * Create vertex
     * @param value         Vertex document
     * @returns {Promise}
     */
    async _addVertex(value, tx) {
        if (value == null || typeof value !== 'object' || Object.keys(value).length === 0) {
            throw new Error(`Invalid vertex ${JSON.stringify(value)}`);
        }
        if (value instanceof BN) {
            value = value.toString();
        }
        if (typeof value === 'object') {
            const objectProps = Neo4jDB._getParams(value);
            let paramString = '';
            for (const v in objectProps.values) {
                const value = JSON.stringify(objectProps.values[v]);
                paramString = `${paramString} ${v}: ${value},`;
            }
            if (paramString.endsWith(',')) {
                paramString = paramString.slice(0, paramString.length - 1);
            }
            if (paramString.length > 0) {
                paramString = `{${paramString}}`;
            }
            const r = await tx.run(`CREATE (a ${paramString}) RETURN a`);
            const nodeId = r.records[0]._fields[0].identity.toString();

            for (const objectProp of Neo4jDB._getNestedObjects(value)) {
                const { edge, subvalue } = objectProp;
                if (Utilities.isEmptyObject(subvalue)) {
                    // eslint-disable-next-line
                    continue;
                }
                // eslint-disable-next-line
                const subnodeId = await this._addVertex(subvalue, tx);
                // eslint-disable-next-line
                await tx.run(`MATCH (a),(b) WHERE ID(a)=${nodeId} AND ID(b)=${subnodeId} CREATE (a)-[r:CONTAINS {value: '${edge}'}]->(b) return r`);
            }
            return nodeId;
        }
    }

    /**
     * Create edge
     * @param edge  Edge document
     * @returns {Promise}
     */
    async addEdge(edge) {
        const edgeType = edge.edge_type;
        const to = edge._to.slice(edge._to.indexOf('/') + 1);
        const from = edge._from.slice(edge._from.indexOf('/') + 1);

        const objectProps = Neo4jDB._getParams(edge, ['_to', '_from']);
        objectProps.values._to = to;
        objectProps.values._from = from;

        let paramString = '';
        for (const v in objectProps.values) {
            const value = JSON.stringify(objectProps.values[v]);
            paramString = `${paramString} ${v}: ${value},`;
        }
        if (paramString.endsWith(',')) {
            paramString = paramString.slice(0, paramString.length - 1);
        }
        if (paramString.length > 0) {
            paramString = `{${paramString}}`;
        }
        const session = this.driver.session();
        const r = await session.writeTransaction(tx => tx.run(`MATCH (a),(b) WHERE a._key='${from}' AND b._key='${to}' CREATE (a)-[r:${edgeType} ${paramString}]->(b) return r`));
        session.close();
        return r;
    }

    /**
     * Transforms Neo4j property to Javascript compatible one
     * @param property Property value
     * @returns {*}
     * @private
     */
    static _transformProperty(property) {
        if (neo4j.isInt(property)) {
            if (neo4j.integer.inSafeRange(property)) {
                return property.toNumber();
            }
            return property.toString();
        }
        if (Array.isArray(property)) {
            const newArray = [];
            for (const item of property) {
                newArray.push(Neo4jDB._transformProperty(item));
            }
            return newArray;
        }
        return property;
    }

    /**
     * Transforms Neo4j properties to Javascript types
     * @param properties    Property values
     * @returns {Promise}
     * @private
     */
    static async _transformProperties(properties) {
        properties.records.forEach((row) => {
            row._fields.forEach((val) => {
                const processProperties = (properties, parent) => {
                    if (properties) {
                        const newProperties = {};
                        for (let key in properties) {
                            const property = properties[key];
                            if (key.includes(':')) {
                                key = key.replace(/_O_SN_/g, ':');
                            }
                            newProperties[key] = Neo4jDB._transformProperty(property);
                        }
                        parent.properties = newProperties;
                    }
                };
                if (Array.isArray(val)) {
                    for (const item of val) {
                        processProperties(item.properties, item);
                    }
                } else {
                    processProperties(val.properties, val);
                }
            });
        });
        return properties;
    }

    /**
     * Gets all CONTAINS edges and forms one vertex
     * @param key           Vertex property key
     * @param value         Vertex property value
     * @returns {Promise}
     * @private
     */
    async _fetchVertex(key, value) {
        const session = this.driver.session();
        let result = await session.readTransaction(tx => tx.run(`MATCH (n { ${key}: ${JSON.stringify(value)} })-[r:CONTAINS *0..]->(k) RETURN n,r,k`));
        session.close();

        result = await Neo4jDB._transformProperties(result);
        const json = {};
        for (const r of result.records) {
            const leftNode = r.get('n');
            const relations = r.get('r');
            const rightNode = r.get('k');

            Object.assign(json, leftNode.properties);
            const nestedKeys = [];
            for (const relation of relations) {
                nestedKeys.push(relation.properties.value);
            }

            if (relations.length > 0) {
                let tempJson = json;
                for (let i = 0; i < nestedKeys.length - 1; i += 1) {
                    tempJson = tempJson[nestedKeys[i]];
                }
                tempJson[nestedKeys[nestedKeys.length - 1]] = rightNode.properties;
            }
        }
        return json;
    }

    /**
     * Gets max where uid is the same and has the max version
     * @param senderId  Sender ID
     * @param uid       Vertex uid
     * @return {Promise<void>}
     */
    async findVertexWithMaxVersion(senderId, uid) {
        const session = this.driver.session();
        const result = await session.readTransaction(tx => tx.run('MATCH (n)-[:CONTAINS]->(i) WHERE i.uid = $uid AND n.sender_id = $senderId RETURN n ORDER BY n.version DESC LIMIT 1', { uid, senderId }));
        session.close();
        if (result.records.length > 0) {
            return this._fetchVertex('_key', result.records[0]._fields[0].properties._key);
        }
        return null;
    }

    /**
     * Gets max where id is the same and has the max version
     * @param senderId  Sender ID
     * @param uid       Edge uid
     * @return {Promise<void>}
     */
    async findEdgeWithMaxVersion(senderId, uid) {
        const session = this.driver.session();
        const result = await session.readTransaction(tx => tx.run('MATCH ()-[r]->() WHERE r.uid = $uid AND r.sender_id = $senderId RETURN r ORDER BY r.version DESC LIMIT 1', { uid, senderId }));
        session.close();
        if (result.records.length > 0) {
            return result.records[0]._fields[0].properties;
        }
        return null;
    }

    /**
     * Find set of vertices
     * @param queryObject       Query for getting vertices
     * @returns {Promise<any>}
     */
    async findVertices(queryObject) {
        const subQueries = [];
        const properties = {};

        let rSuffix = 1;
        let kSuffix = 1;

        for (const key in queryObject) {
            if (key.match(/^[\w\d]+$/g) !== null) {
                let searchKey;
                if (key !== 'vertex_type' && key !== '_key') {
                    searchKey = `identifiers.${key}`;
                } else {
                    searchKey = key;
                }
                const isComposite = searchKey.indexOf('.') !== -1;

                if (isComposite) {
                    const keyParts = searchKey.split('.');

                    let subQuery = 'match (n)';
                    let wheres = null;
                    for (let i = 0; i < keyParts.length - 1; i += 1) {
                        const subkey = keyParts[i];
                        subQuery += `-[r_${rSuffix}:CONTAINS]`;
                        if (wheres == null) {
                            wheres = `r_${rSuffix}.value = '${subkey}'`;
                        } else {
                            wheres += `AND r_${rSuffix}.value = '${subkey}'`;
                        }
                        rSuffix += 1;
                    }
                    subQuery += `-(k_${kSuffix}) WHERE ${wheres} AND k_${kSuffix}.${keyParts[keyParts.length - 1]} = ${JSON.stringify(queryObject[key])}`;
                    kSuffix += 1;
                    subQueries.push(subQuery);
                } else {
                    properties[searchKey] = queryObject[key];
                }
            }
        }

        let query;
        if (Utilities.isEmptyObject(properties)) {
            query = 'match (n)';
        } else {
            query = 'match (n {';
            for (const propertyKey in properties) {
                const property = properties[propertyKey];
                query += `${propertyKey}: ${JSON.stringify(property)}`;
            }
            query += '})';
        }

        for (const subQuery of subQueries) {
            query += ` with n ${subQuery}`;
        }
        query += ' return n';
        const session = this.driver.session();
        let result = await session.readTransaction(tx => tx.run(query));
        session.close();
        result = await Neo4jDB._transformProperties(result);
        const nodePromises = [];
        for (const record of result.records) {
            nodePromises.push(this._fetchVertex('_key', record._fields[0].properties._key));
        }
        result = await Promise.all(nodePromises);
        return result;
    }

    /**
     * Find traversal path for key/value start
     * @param startVertex Start vertex
     * @param depth       Explicit traversal depth
     * @return
     */
    async findTraversalPath(startVertex, depth) {
        const key = '_key';
        const value = startVertex._key;
        const session = this.driver.session();
        const rawGraph = await session.readTransaction(tx => tx.run(`MATCH (n {${key}: ${JSON.stringify(value)}})-[r* 1..${depth}]->(k) WHERE NONE(rel in r WHERE type(rel)="CONTAINS") RETURN n,r,k ORDER BY length(r)`));
        session.close();
        return this.convertToVirtualGraph(rawGraph);
    }

    /**
     * Transforms raw graph data to virtual one (without
     * @param rawGraph  Raw graph structure
     * @returns {{}}
     */
    async convertToVirtualGraph(rawGraph) {
        const vertices = {};
        for (const r of rawGraph.records) {
            const leftNode = r.get('n');
            const rightNode = r.get('k');

            const relations = r.get('r');
            const relation = relations[relations.length - 1];

            let first = vertices[leftNode.properties._key];
            if (!first) {
                // eslint-disable-next-line
                first = await this._fetchVertex('_key', leftNode.properties._key);
                vertices[first._key] = first;
                vertices[first._key].outbound = [];
            }

            let second = vertices[rightNode.properties._key];
            if (!second) {
                // eslint-disable-next-line
                second = await this._fetchVertex('_key', rightNode.properties._key);
                vertices[second._key] = second;
                vertices[second._key].outbound = [];
            }

            const fromNode = vertices[relation.properties._from];
            const transformedRelation = {};
            for (const key in relation.properties) {
                transformedRelation[key] = Neo4jDB._transformProperty(relation.properties[key]);
            }
            fromNode.outbound.push(transformedRelation);
        }
        return {
            data: vertices,
        };
    }

    /**
     * Updates document with the import ID
     * @param collectionName
     * @param key
     * @param importNumber
     */
    async updateImports(collectionName, key, importNumber) {
        if (collectionName === 'ot_edges') {
            return [];
        }
        const session = this.driver.session();
        const result = await session.readTransaction(tx => tx.run('MATCH (n) WHERE n._key = $_key RETURN n', {
            _key: key,
        }));
        let { imports } = result.records[0]._fields[0].properties;
        if (imports) {
            imports.push(importNumber);
        } else {
            imports = [importNumber];
        }
        await session.writeTransaction(tx => tx.run('MATCH(n) WHERE n._key = $_key SET n.imports = $imports return n', {
            _key: key,
            imports,
        }));
        session.close();
    }

    /**
     * Updates vertex imports by ID
     * @param senderId
     * @param uid
     * @param importNumber
     * @return {Promise<*>}
     */
    async updateVertexImportsByUID(senderId, uid, importNumber) {
        const result = await this.findVertexWithMaxVersion(senderId, uid);
        const session = this.driver.session();
        let { imports } = result;
        if (imports) {
            imports.push(importNumber);
        } else {
            imports = [importNumber];
        }
        const response = await session.writeTransaction(tx => tx.run('MATCH (n) WHERE n._key = $_key SET n.imports = $imports return n', {
            _key: result._key,
            imports,
        }));
        session.close();
        return response;
    }

    /**
     * Updates edge imports by ID
     * @param senderId
     * @param uid
     * @param importNumber
     * @return {Promise<*>}
     */
    async updateEdgeImportsByUID(senderId, uid, importNumber) {
        const result = await this.findEdgeWithMaxVersion(senderId, uid);
        const session = this.driver.session();
        let { imports } = result;
        if (imports) {
            imports.push(importNumber);
        } else {
            imports = [importNumber];
        }
        const response = await session.writeTransaction(tx => tx.run('MATCH ()-[r]->() WHERE r._key = $_key SET r.imports = $imports return r', {
            _key: result._key,
            imports,
        }));
        session.close();
        return response;
    }

    /**
     * Gets vertices by the import ID
     * @param importId  Import ID
     * @return {Promise}
     */
    async findVerticesByImportId(importId) {
        const session = this.driver.session();
        const result = await session.readTransaction(tx => tx.run(`match (n) where ${importId} in n.imports return n`));

        const nodes = [];
        for (const record of result.records) {
            // eslint-disable-next-line
            nodes.push(await this._fetchVertex('_key', record._fields[0].properties._key));
        }
        return nodes;
    }

    /**
     * Gets edges by the import ID
     * @param importId  Import ID
     * @return {Promise}
     */
    async findEdgesByImportId(importId) {
        const session = this.driver.session();
        const result = await Neo4jDB._transformProperties(await session.readTransaction(tx => tx.run(`match (n)-[r]-(m) where ${importId} in r.imports return distinct r`)));

        const nodes = [];
        for (const record of result.records) {
            nodes.push(record._fields[0].properties);
        }
        return nodes;
    }

    /**
     * Find event based on ID and bizStep
     * Note: based on bizStep we define INPUT(shipping) or OUTPUT(receiving)
     * @param senderId   Sender ID
     * @param partnerId  Partner ID
     * @param documentId Document ID
     * @param bizStep   BizStep value
     * @return {Promise}
     */
    async findEvent(senderId, partnerId, documentId, bizStep) {
        const session = this.driver.session();
        let result = await session.readTransaction(tx => tx.run('MATCH (n)-[:CONTAINS]->(i) WHERE i.document_id = $documentId AND $senderId in n.partner_id AND n.sender_id = $partnerId RETURN n', { documentId, senderId, partnerId }));
        session.close();
        result = await Neo4jDB._transformProperties(result);
        const nodePromises = [];
        for (const record of result.records) {
            nodePromises.push(this._fetchVertex('_key', record._fields[0].properties._key));
        }
        result = await Promise.all(nodePromises);
        return result.filter(event => event.data.bizStep && event.data.bizStep.endsWith(bizStep));
    }

    /**
     * Shut down the driver
     */
    close() {
        this.driver.close();
    }

    /**
     * Clear the db
     * @return {Promise}
     */
    async clear() {
        // this.log.debug('Clear the database.');
        const session = this.driver.session();
        await session.writeTransaction(tx => tx.run('match (n) detach delete n'));
        session.close();
    }

    /**
     * Identify selected database as Neo4j
     * @returns {string} - Graph database identifier string
     */
    identify() {
        return 'Neo4j';
    }
    /**
     * Get Neo4j
     * @param {string} - host
     * @param {string} - port
     * @param {string} - username
     * @param {string} - password
     * @returns {Promise<any>}
     */
    async version(host, port, username, password) {
        const result = await request
            .get(`http://${host}:7474/db/data/`)
            .auth(username, password);

        try {
            if (result.status === 200) {
                return result.body.neo4j_version;
            }
        } catch (error) {
            throw Error(`Failed to contact neo4j${error}`);
        }
    }
}

module.exports = Neo4jDB;
