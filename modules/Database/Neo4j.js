const neo4j = require('neo4j-driver').v1;
const Utilities = require('../Utilities');

const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'pass'));

class Neo4jDB {
    constructor(username, password, database, host, port) {
        // TODO add proper params
        this.driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'pass'));
        this.session = driver.session();
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
                let isComposite = false;
                for (const item in obj[p]) {
                    if (typeof item === 'object') {
                        isComposite = true;
                        break;
                    }
                }
                const array = [];
                for (const item in obj[p]) {
                    if (isComposite) {
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
    createVertex(value) {
        return new Promise((resolve, reject) => {
            if (typeof value === 'object') {
                const nonObjectProps = `{${Neo4jDB._getPropertiesString(value)}}`;
                this.session.run(`CREATE (a ${nonObjectProps}) RETURN a`).then((r) => {
                    const nodeId = r.records[0]._fields[0].identity.toString();

                    const objectProps = Neo4jDB._getNestedObjects(value);
                    const vertexPromises = [];

                    Promise.all(objectProps.map(objectProp => new Promise((resolve) => {
                        const { edge, subvalue } = objectProp;
                        vertexPromises.push(this.createVertex(subvalue).then((subnodeId) => {
                            this.session.run(`MATCH (a),(b) WHERE ID(a)=${nodeId} AND ID(b)=${subnodeId} CREATE (a)-[r:CONTAINS {value: '${edge}'}]->(b) return r`).then((r) => {
                                resolve(nodeId);
                            }).catch((err) => {
                                reject(err);
                            });
                        }).catch((err) => {
                            reject(err);
                        }));
                    }))).then(() => {
                        resolve(nodeId);
                    });
                }).catch((err) => {
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
    createEdge(edge) {
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
            this.session.run(`MATCH (a),(b) WHERE a._key='${from}' AND b._key='${to}' CREATE (a)-[r:${edgeType} ${nonObjectProps}]->(b) return r`).then((r) => {
                resolve(r);
            }).catch((err) => {
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
     * Get single vertex
     * @param key           Vertex property key
     * @param value         Vertex property value
     * @returns {Promise}
     */
    find(key, value) {
        return new Promise((resolve, reject) => {
            this.session.run(`MATCH (n { ${key}: ${JSON.stringify(value)} })-[r:CONTAINS *1..]->(k) RETURN n,r,k`).then(this._transformProperties).then((result) => {
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

                    let tempJson = json;
                    for (let i = 0; i < nestedKeys.length - 1; i += 1) {
                        tempJson = tempJson[nestedKeys[i]];
                    }
                    tempJson[nestedKeys[nestedKeys.length - 1]] = rightNode.properties;
                }
                resolve(json);
            }).catch((err) => {
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
            this.session.run(query).then(this._transformProperties).then((result) => {
                const nodePromises = [];
                for (const record of result.records) {
                    nodePromises.push(that.find('_key', record._fields[0].properties._key));
                }
                Promise.all(nodePromises).then((nodes) => {
                    resolve(nodes);
                }).catch((err) => {
                    reject(err);
                });
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Find traversal path for key/value start
     * @param startVertex Start vertex
     * @return
     */
    findTraversalPath(startVertex) {
        return new Promise((resolve, reject) => {
            const key = '_key';
            const value = startVertex._key;
            const depth = that.getDatabaseInfo().max_path_length;

            this.session.run(`MATCH (n {${key}: ${JSON.stringify(value)}})-[r* 1..${depth}]->(k) WHERE NONE(rel in r WHERE type(rel)="CONTAINS") RETURN n,r,k,length(r) as s ORDER BY s`)
                .then(this._transformProperties)
                .then((result) => {
                const vertices = {};

                Promise.all(result.records.map(r => new Promise((resolve) => {
                    const leftNode = r.get('n');
                    const relations = r.get('r');
                    const rightNode = r.get('k');

                    let first = Promise.resolve();
                    if (!vertices[leftNode.properties._key]) {
                        first = this.find('_key', leftNode.properties._key).then((r) => {
                            r.key = r._key;
                            delete r._key;
                            vertices[r.key] = r;
                            vertices[r.key].edges = [];
                        });
                    }

                    let second = Promise.resolve();
                    if (!vertices[rightNode.properties._key]) {
                        second = this.find('_key', rightNode.properties._key).then((r) => {
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
     * Runs query on selected database
     * @param {string} - queryString - Query string
     * @param {object} - params - Query parameters
     * @returns {Promise<any>}
     */
    runQuery(queryString, params) {
        return new Promise((resolve, reject) => {
            resolve();
        })
    }

    /**
     * Update document in selected graph database
     * @param {string} - collectionName
     * @param {object} - document
     * @returns {Promise<any>}
     */
    updateDocument(collectionName, document) {
        return new Promise((resolve, reject) => {
            resolve();
        })
    }

    /**
     * Get document from selected graph database
     * @param collectionName
     * @param document
     */
    getDocument(collectionName, documentKey) {
        return new Promise((resolve, reject) => {
            resolve();
        })
    }

    /**
     * Add edge
     * @param collection_name
     * @param edge
     * @return {Promise}
     */
    addEdge(collection_name, edge) {
        return this.createEdge(edge);
    }

    /**
     * Add vertex
     * @param collection_name
     * @param vertex
     * @return {Promise}
     */
    addVertex(collection_name, vertex) {
        return this.createVertex(vertex);
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
            this.session.run(`MATCH(n) WHERE n._key = '${document._key}' SET n.imports = n.imports + ${importNumber} return n`).then((res) => {
                resolve(res);
            }).catch((err) => {
                reject(err);
            });
        });
    }

    /**
     * Create document collection, if collection does not exist
     * @param collectionName
     */
    createCollection(collectionName) {
        return new Promise((resolve, reject) => {
            resolve();
        })
    }

    createEdgeCollection(collectionName) {
        return new Promise((resolve, reject) => {
            resolve();
        })
    }

    /**
     * Gets vertices by the import ID
     * @param importId  Import ID
     * @return {Promise}
     */
    getVerticesByImportId(importId) {
        return new Promise((resolve, reject) => {
            this.session.run(`match(n) where ${importId} in n.imports return n`).then((result) => {
                const nodePromises = [];
                for (const record of result.records) {
                    nodePromises.push(that.find('_key', record._fields[0].properties._key));
                }
                Promise.all(nodePromises).then((nodes) => {
                    resolve(nodes);
                }).catch((err) => {
                    reject(err);
                })
            }).catch((err) => {
                reject(err);
            })
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
                promise = that.createVertex(document);
            } else {
                promise = that.createEdge(document);
            }
            promise.then((res) => {
                resolve(res);
            }).catch((err) => {
                reject(err);
            })
        });
    }

}

module.exports = Neo4jDB;