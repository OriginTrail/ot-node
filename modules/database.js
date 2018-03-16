// External modules
const utilities = require('./utilities');

const log = utilities.getLogger();
// eslint-disable-next-line  prefer-destructuring
const Database = require('arangojs').Database;

const config = utilities.getConfig();

const username = config.DB_USERNAME;
const password = config.DB_PASSWORD;
// const host = config.DB_HOST;
// const port = config.DB_PORT;
const database = config.DB_DATABASE;

const db = new Database();
db.useDatabase(database);
db.useBasicAuth(username, password);

module.exports = function () {
    // eslint-disable-next-line no-shadow
    const database = {
        getConnection() {
            return db;
        },

        async runQuery(queryString, callback, params = {}) {
            try {
                const cursor = await db.query(queryString, params);
                // eslint-disable-next-line no-underscore-dangle
                utilities.executeCallback(callback, cursor._result);
            } catch (err) {
                utilities.executeCallback(callback, []);
                console.log(err);
            }
        },
        async createVertexCollection(collection_name, callback) {
            const collection = db.collection(collection_name);
            collection.create().then(
                () => {
                    log.info('Collection created');
                    utilities.executeCallback(callback, true);
                },
                (err) => {
                    if (err.response.body.code === 409) {
                        log.info('collection already exists');
                        utilities.executeCallback(callback, true);
                    } else {
                        log.info(err);
                        utilities.executeCallback(callback, false);
                    }
                },
            );
        },
        async createEdgeCollection(collection_name, callback) {
            const collection = db.edgeCollection(collection_name);
            collection.create().then(
                () => {
                    log.info('Collection created');
                    utilities.executeCallback(callback, true);
                },
                (err) => {
                    if (err.response.body.code === 409) {
                        log.info('collection already exists');
                        utilities.executeCallback(callback, true);
                    } else {
                        log.info(err);
                        utilities.executeCallback(callback, false);
                    }
                },
            );
        },

        addVertex(collection_name, vertex, callback) {
            const collection = db.collection(collection_name);
            collection.save(vertex).then(
                meta => utilities.executeCallback(callback, true),
                (err) => {
                    // console.error('Failed to save document:', err)
                    utilities.executeCallback(callback, false);
                },
            );
        },

        addEdge(collection_name, edge, callback) {
            const collection = db.collection(collection_name);
            collection.save(edge).then(
                meta => utilities.executeCallback(callback, true),
                (err) => {
                    // console.error('Failed to save document:', err)
                    utilities.executeCallback(callback, false);
                },
            );
        },

        updateDocumentImports(collection_name, document_key, import_number, callback) {
            const collection = db.collection(collection_name);
            collection.document(document_key).then(
                (doc) => {
                    // eslint-disable-next-line prefer-destructuring
                    let imports = doc.imports;

                    if (imports === undefined) { imports = []; }

                    if (imports.indexOf(import_number) === -1) {
                        imports.push(import_number);
                        collection.update(document_key, { imports }).then(
                            meta => utilities.executeCallback(callback, true),
                            (err) => {
                                log.info(err);
                                utilities.executeCallback(callback, false);
                            },
                        );
                    }
                },
                (err) => {
                    log.info(err);
                    utilities.executeCallback(callback, false);
                },
            );
        },

        async getVerticesByImportId(data_id, callback) {
            const queryString = 'FOR v IN ot_vertices FILTER POSITION(v.imports, @importId, false) != false RETURN v';
            const params = { importId: data_id };

            try {
                const cursor = await db.query(queryString, params);
                // eslint-disable-next-line no-underscore-dangle
                utilities.executeCallback(callback, cursor._result);
            } catch (err) {
                utilities.executeCallback(callback, []);
                log.info(err);
            }
        },

        async getEdgesByImportId(data_id, callback) {
            const queryString = 'FOR v IN ot_edges FILTER POSITION(v.imports, @importId, false) != false RETURN v';
            const params = { importId: data_id };

            try {
                const cursor = await db.query(queryString, params);
                // eslint-disable-next-line no-underscore-dangle
                utilities.executeCallback(callback, cursor._result);
            } catch (err) {
                utilities.executeCallback(callback, []);
                log.info(err);
            }
        },
    };

    return database;
};
