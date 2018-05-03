const neo4j = require('neo4j-driver').v1;
const Utilities = require('../Utilities');

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
     * @returns {string}    Properties string
     * @private
     */
    static _getPropertiesString(obj, excludeList) {
        let result = '';
        for (const p in obj) {
            if (typeof obj[p] !== 'object') {
                if (!excludeList || !excludeList.includes(p)) {
                    result += `${p}: ${JSON.stringify(obj[p])},`;
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
                    result += `${p}: ${JSON.stringify(array)},`;
                }
            }
        }
        if (result.endsWith(',')) {
            result = result.slice(0, result.length - 1);
        }
        return result;
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
     * @param value Vertex document
     * @returns {Promise}
     */
    _createVertex(value) {
        return new Promise((resolve, reject) => {
            if (typeof value === 'object') {
                let session = this.driver.session();
                const nonObjectProps = `{${Neo4jDB._getPropertiesString(value)}}`;
                session.run(`CREATE (a ${nonObjectProps}) RETURN a`).then((r) => {
                    session.close();
                    const nodeId = r.records[0]._fields[0].identity.toString();

                    const objectProps = Neo4jDB._getNestedObjects(value);
                    const vertexPromises = [];

                    Promise.all(objectProps.map(objectProp => new Promise((resolve) => {
                        const { edge, subvalue } = objectProp;
                        vertexPromises.push(this._createVertex(subvalue)
                            .then((subnodeId) => {
                                session = this.driver.session();
                                session.run(`MATCH (a),(b) WHERE ID(a)=${nodeId} AND ID(b)=${subnodeId} CREATE (a)-[r:CONTAINS {value: '${edge}'}]->(b) return r`)
                                    .then((r) => {
                                        session.close();
                                        resolve(nodeId);
                                    }).catch((err) => {
                                        session.close();
                                        reject(err);
                                    });
                            }).catch((err) => {
                                reject(err);
                            }));
                    }))).then(() => {
                        resolve(nodeId);
                    });
                }).catch((err) => {
                    session.close();
                    reject(err);
                });
            }
        });
    }

    /**
     * Create edge
     * @param edge  Edge document
     * @returns {Promise}
     */
    _createEdge(edge) {
        return new Promise((resolve, reject) => {
            const edgeType = edge.edge_type;
            const to = edge._to.slice(edge._to.indexOf('/') + 1);
            const from = edge._from.slice(edge._from.indexOf('/') + 1);

            let nonObjectProps = `${Neo4jDB._getPropertiesString(edge, ['_to', '_from'])}`;
            if (nonObjectProps.length > 0) {
                nonObjectProps = `{${nonObjectProps}, _to: ${JSON.stringify(to)}, _from: ${JSON.stringify(from)}}`;
            } else {
                nonObjectProps = `{_to: ${JSON.stringify(to)}, _from: ${JSON.stringify(from)}}`;
            }
            const session = this.driver.session();
            session.run(`MATCH (a),(b) WHERE a._key='${from}' AND b._key='${to}' CREATE (a)-[r:${edgeType} ${nonObjectProps}]->(b) return r`).then((r) => {
                session.close();
                resolve(r);
            }).catch((err) => {
                session.close();
                reject(err);
            });
        });
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
                newArray.push(this._transformProperty(deserialized));
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
    _transformProperties(properties) {
        return new Promise((resolve, reject) => {
            try {
                properties.records.forEach((row, i) => {
                    row._fields.forEach((val, j) => {
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
                resolve(properties);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Gets all CONTAINS edges and forms one vertex
     * @param key           Vertex property key
     * @param value         Vertex property value
     * @returns {Promise}
     * @private
     */
    _fetchVertex(key, value) {
        return new Promise((resolve, reject) => {
            const session = this.driver.session();
            session.run(`MATCH (n { ${key}: ${JSON.stringify(value)} })-[r:CONTAINS *0..]->(k) RETURN n,r,k`)
                .then(this._transformProperties)
                .then((result) => {
                    session.close();
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
                    resolve(json);
                }).catch((err) => {
                    session.close();
                    reject(err);
                });
        });
    }

    /**
     * Find set of vertices
     * @param queryObject       Query for getting vertices
     * @returns {Promise<any>}
     */
    findVertices(queryObject) {
        const that = this;
        return new Promise((resolve, reject) => {
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
            session.run(query).then(this._transformProperties).then((result) => {
                session.close();
                const nodePromises = [];
                for (const record of result.records) {
                    nodePromises.push(that._fetchVertex('_key', record._fields[0].properties._key));
                }
                Promise.all(nodePromises).then((nodes) => {
                    resolve(nodes);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                session.close();
                reject(err);
            });
        });
    }

    /**
     * Find traversal path for key/value start
     * @param startVertex Start vertex
     * @param depth       Explicit traversal depth
     * @return
     */
    findTraversalPath(startVertex, depth) {
        const that = this;
        return new Promise((resolve, reject) => {
            const key = '_key';
            const value = startVertex._key;
            if (!depth) {
                depth = that.getDatabaseInfo().max_path_length;
            }

            const session = this.driver.session();
            session.run(`MATCH (n {${key}: ${JSON.stringify(value)}})-[r* 1..${depth}]->(k) WHERE NONE(rel in r WHERE type(rel)="CONTAINS") RETURN n,r,k,length(r) as s ORDER BY s`)
                .then(this._transformProperties)
                .then((result) => {
                    session.close();
                    const vertices = {};

                    Promise.all(result.records.map(r => new Promise((resolve) => {
                        const leftNode = r.get('n');
                        const relations = r.get('r');
                        const rightNode = r.get('k');

                        let first = Promise.resolve();
                        if (!vertices[leftNode.properties._key]) {
                            first = this._fetchVertex('_key', leftNode.properties._key).then((r) => {
                                r.key = r._key;
                                delete r._key;
                                vertices[r.key] = r;
                                vertices[r.key].edges = [];
                            });
                        }

                        let second = Promise.resolve();
                        if (!vertices[rightNode.properties._key]) {
                            second = this._fetchVertex('_key', rightNode.properties._key).then((r) => {
                                r.key = r._key;
                                delete r._key;
                                vertices[r.key] = r;
                                vertices[r.key].edges = [];
                            });
                        }

                        Promise.all([first, second]).then(() => {
                            let relation = relations[0];
                            for (let i = 0; i < relations.length - 1; i += 1) {
                                relation = relations[i];
                            }
                            const toInsertNode = vertices[relation.properties._to];
                            Object.assign(relation, relation.properties);
                            delete relation.properties;
                            delete relation.identity;
                            delete relation.start;
                            delete relation.end;
                            toInsertNode.edges.push(relation);
                            resolve();
                        });
                    }))).then(() => {
                        const res = [];
                        for (const k in vertices) {
                            res.push(vertices[k]);
                        }
                        resolve(res);
                    }).catch((err) => {
                        reject(err);
                    });
                }).catch((err) => {
                    session.close();
                    reject(err);
                });
        });
    }

    /**
     * Updates document with the import ID
     * @param collectionName
     * @param document
     * @param importNumber
     */
    updateDocumentImports(collectionName, document, importNumber) {
        return new Promise((resolve, reject) => {
            if (collectionName === 'ot_edges') {
                resolve([]);
                return;
            }
            const session = this.driver.session();
            session.run(`MATCH(n) WHERE n._key = '${document._key}' SET n.imports = n.imports + ${importNumber} return n`).then((res) => {
                session.close();
                resolve(res);
            }).catch((err) => {
                session.close();
                reject(err);
            });
        });
    }

    /**
     * Gets vertices by the import ID
     * @param importId  Import ID
     * @return {Promise}
     */
    getVerticesByImportId(importId) {
        const that = this;
        return new Promise((resolve, reject) => {
            const session = this.driver.session();
            session.run(`match(n) where ${importId} in n.imports return n`).then((result) => {
                session.close();
                const nodePromises = [];
                for (const record of result.records) {
                    nodePromises.push(that._fetchVertex('_key', record._fields[0].properties._key));
                }
                Promise.all(nodePromises).then((nodes) => {
                    resolve(nodes);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                session.close();
                reject(err);
            });
        });
    }

    /**
     * Add new document into given collection
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    addDocument(collectionName, document) {
        const that = this;
        return new Promise((resolve, reject) => {
            let promise = null;
            if (collectionName === 'ot_vertices') {
                promise = that._createVertex(document);
            } else {
                promise = that._createEdge(document);
            }
            promise.then((res) => {
                resolve(res);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Identify selected database as Neo4j
     * @returns {string} - Graph database identifier string
     */
    identify() {
        return 'Neo4j';
    }

    /**
     * This method is not applicable in Neo4jDB
     * @deprecated
     */
    createCollection(collectionName) {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }

    /**
     * This method is not applicable in Neo4jDB
     * @deprecated
     */
    createEdgeCollection(collectionName) {
        return new Promise((resolve, reject) => {
            resolve();
        });
    }
}

module.exports = Neo4jDB;
