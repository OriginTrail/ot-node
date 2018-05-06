const neo4j = require('neo4j-driver').v1;
const Utilities = require('../Utilities');

const log = Utilities.getLogger();

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
    constructor(username, password, database, host, port) {
        this.driver = neo4j.driver(`bolt://${host}:${port}`, neo4j.auth.basic(username, password));
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
            if (typeof obj[p] !== 'object') {
                if (!excludeList || !excludeList.includes(p)) {
                    values[p] = obj[p];
                    queries.push(`${p}:$${p}`);
                }
            } else if (Array.isArray(obj[p])) {
                const array = [];
                for (const item of obj[p]) {
                    if (typeof item === 'object' || Array.isArray(item)) {
                        array.push(JSON.stringify(item));
                    } else {
                        array.push(item);
                    }
                }
                if (!excludeList || !excludeList.includes(p)) {
                    values[p] = array;
                    queries.push(`${p}:$${p}`);
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
            if (typeof obj[p] === 'object' && !Array.isArray(obj[p])) {
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
     * @private
     */
    async _createVertex(value) {
        const session = this.driver.session();
        if (value == null || typeof value !== 'object' || Object.keys(value).length === 0) {
            throw new Error(`Invalid vertex ${JSON.stringify(value)}`);
        }
        if (typeof value === 'object') {
            const objectProps = Neo4jDB._getParams(value);
            let params = '';
            if (objectProps.queries.length > 0) {
                params = ` {${objectProps.queries.join()}}`;
            }
            const r = await session.run(`CREATE (a${params}) RETURN a`, objectProps.values);
            const nodeId = r.records[0]._fields[0].identity.toString();

            for (const objectProp of Neo4jDB._getNestedObjects(value)) {
                const { edge, subvalue } = objectProp;
                // eslint-disable-next-line
                const subnodeId = await this._createVertex(subvalue);
                // eslint-disable-next-line
                await session.run(`MATCH (a),(b) WHERE ID(a)=${nodeId} AND ID(b)=${subnodeId} CREATE (a)-[r:CONTAINS {value: '${edge}'}]->(b) return r`);
            }
            return nodeId;
        }
    }

    /**
     * Create edge
     * @param edge  Edge document
     * @returns {Promise}
     * @private
     */
    async _createEdge(edge) {
        const edgeType = edge.edge_type;
        const to = edge._to.slice(edge._to.indexOf('/') + 1);
        const from = edge._from.slice(edge._from.indexOf('/') + 1);

        const objectProps = Neo4jDB._getParams(edge, ['_to', '_from']);
        objectProps.queries.push('_to:$_to');
        objectProps.queries.push('_from:$_from');
        objectProps.values._to = to;
        objectProps.values._from = from;
        const params = ` {${objectProps.queries.join()}}`;
        const session = this.driver.session();
        const r = await session.run(`MATCH (a),(b) WHERE a._key='${from}' AND b._key='${to}' CREATE (a)-[r:${edgeType}${params}]->(b) return r`, objectProps.values);
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
                let deserialized = item;
                try {
                    deserialized = JSON.parse(item);
                } catch (e) {
                    // skip
                }
                newArray.push(Neo4jDB._transformProperty(deserialized));
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
                        for (const key in properties) {
                            const property = properties[key];
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
        let result = await session.run(`MATCH (n { ${key}: ${JSON.stringify(value)} })-[r:CONTAINS *0..]->(k) RETURN n,r,k`);
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
     * Gets max version where uid is the same but not the _key
     * @param uid   Vertex uid
     * @param _key  Vertex _key
     * @return {Promise<void>}
     */
    async getCurrentMaxVersion(uid, _key) {
        const session = this.driver.session();
        const result = await session.run('MATCH (n) WHERE n.uid = $uid and n._key <> $_key return MAX(n.version)', { uid, _key });
        session.close();
        return result;
    }

    /**
     * Gets max vertex_key where uid is the same and has the max version
     * @param uid   Vertex uid
     * @return {Promise<void>}
     */
    async getVertexKeyWithMaxVersion(uid) {
        const session = this.driver.session();
        const result = await session.run('MATCH (n) WHERE n.uid = $uid RETURN n.version AS v ORDER BY v DESC LIMIT 1', { uid });
        session.close();
        return result;
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
        let result = await session.run(query);
        session.close();
        result = await Neo4jDB._transformProperties(result);
        const nodePromises = [];
        for (const record of result.records) {
            nodePromises.push(this._fetchVertex('_key', record._fields[0].properties._key));
        }
        return Promise.all(nodePromises);
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
        if (depth == null) {
            depth = this.getDatabaseInfo().max_path_length;
        }

        const session = this.driver.session();
        const result = await session.run(`MATCH (n {${key}: ${JSON.stringify(value)}})-[r* 1..${depth}]->(k) WHERE NONE(rel in r WHERE type(rel)="CONTAINS") RETURN n,r,k ORDER BY length(r)`);
        session.close();

        const vertices = {};
        for (const r of result.records) {
            const leftNode = r.get('n');
            const rightNode = r.get('k');

            const relations = r.get('r');
            const relation = relations[relations.length - 1];

            let first = vertices[leftNode.properties._key];
            if (!first) {
                // eslint-disable-next-line
                first = await this._fetchVertex('_key', leftNode.properties._key);
                first.key = first._key;
                delete first._key;
                vertices[first.key] = first;
                vertices[first.key].edges = [];
            }

            let second = vertices[rightNode.properties._key];
            if (!second) {
                // eslint-disable-next-line
                second = await this._fetchVertex('_key', rightNode.properties._key);
                second.key = second._key;
                delete second._key;
                vertices[second.key] = second;
                vertices[second.key].edges = [];
            }

            const fromNode = vertices[relation.properties._from];
            Object.assign(relation, relation.properties);
            delete relation.properties;
            delete relation.identity;
            delete relation.start;
            delete relation.end;
            fromNode.edges.push(relation);
        }

        const res = [];
        for (const k in vertices) {
            res.push(vertices[k]);
        }
        return res;
    }

    /**
     * Updates document with the import ID
     * @param collectionName
     * @param document
     * @param importNumber
     */
    async updateDocumentImports(collectionName, document, importNumber) {
        if (collectionName === 'ot_edges') {
            return [];
        }
        const session = this.driver.session();
        return session.run(`MATCH(n) WHERE n._key = '${document._key}' SET n.imports = n.imports + ${importNumber} return n`);
    }

    /**
     * Gets vertices by the import ID
     * @param importId  Import ID
     * @return {Promise}
     */
    async getVerticesByImportId(importId) {
        const session = this.driver.session();
        const result = await session.run(`match (n) where ${importId} in n.imports return n`);

        const nodes = [];
        for (const record of result.records) {
            // eslint-disable-next-line
            nodes.push(await this._fetchVertex('_key', record._fields[0].properties._key));
        }
        return nodes;
    }

    /**
     * Add new document into given collection
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    async addDocument(collectionName, document) {
        if (collectionName === 'ot_vertices') {
            await this._createVertex(document);
        } else {
            await this._createEdge(document);
        }
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
        log.debug('Clear the database.');
        const session = this.driver.session();
        await session.run('match (n) detach delete n');
    }

    /**
     * This method is not applicable in Neo4jDB
     * @deprecated
     */
    createCollection() {
        return new Promise((resolve) => {
            resolve();
        });
    }

    /**
     * This method is not applicable in Neo4jDB
     * @deprecated
     */
    createEdgeCollection() {
        return new Promise((resolve) => {
            resolve();
        });
    }

    /**
     * Identify selected database as Neo4j
     * @returns {string} - Graph database identifier string
     */
    identify() {
        return 'Neo4j';
    }
}

module.exports = Neo4jDB;
