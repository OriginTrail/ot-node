// External modules
const PythonShell = require('python-shell');
const utilities = require('./utilities')();

const log = utilities.getLogger();
const config = utilities.getConfig();
const Mtree = require('./mtree')();
const storage = require('./storage')();
const blockchain = require('./blockchain')();
const signing = require('./blockchain_interface/ethereum/signing')();
const async = require('async');
const db = require('./database')();

const replication = require('./DataReplication');

module.exports = function () {
    const importer = {

        async importJSON(json_document, callback) {
            log.info('Entering importJSON');
            const graph = json_document;
            await db.createVertexCollection('ot_vertices', () => {});
            await db.createEdgeCollection('ot_edges', () => {});

            // eslint-disable-next-line  prefer-destructuring
            const vertices = graph.vertices;
            // eslint-disable-next-line  prefer-destructuring
            const edges = graph.edges;
            const data_id = graph.import_id;

            async.each(vertices, (vertex, next) => {
                db.addVertex('ot_vertices', vertex, (import_status) => {
                    if (import_status === false) {
                        // eslint-disable-next-line no-underscore-dangle
                        db.updateDocumentImports('ot_vertices', vertex._key, data_id, (update_status) => {
                            if (update_status === false) {
                                log.info('Import error!');
                                return;
                            }

                            next();
                        });
                    } else {
                        next();
                    }
                });
            }, () => {

            });

            async.each(edges, (edge, next) => {
                db.addEdge('ot_edges', edge, (import_status) => {
                    if (import_status === false) {
                        // eslint-disable-next-line no-underscore-dangle
                        db.updateDocumentImports('ot_edges', edge._key, data_id, (update_status) => {
                            if (update_status === false) {
                                log.info('Import error!');
                                return;
                            }

                            next();
                        });
                    } else {
                        next();
                    }
                });
            }, () => {
                log.info('JSON import complete');
            });

            utilities.executeCallback(callback, true);
        },

        // eslint-disable-next-line no-shadow
        importXML: async function async(ot_xml_document, callback) {
            const options = {
                mode: 'text',
                pythonPath: 'python3',
                scriptPath: 'importers/',
                args: [ot_xml_document],
            };

            PythonShell.run('v1.5.py', options, (stderr, stdout) => {
                if (stderr) {
                    log.info(stderr);
                    utilities.executeCallback(callback, {
                        message: 'Import failure',
                        data: [],
                    });
                    return;
                }
                log.info('[DC] Import complete');
                const result = JSON.parse(stdout);
                // eslint-disable-next-line  prefer-destructuring
                const vertices = result.vertices;
                // eslint-disable-next-line  prefer-destructuring
                const edges = result.edges;
                const data_id = result.import_id;


                const leaves = [];
                const hash_pairs = [];

                for (const i in vertices) {
                    // eslint-disable-next-line max-len
                    leaves.push(utilities.sha3(utilities.sortObject({ identifiers: vertices[i].identifiers, data: vertices[i].data })));
                    // eslint-disable-next-line no-underscore-dangle
                    hash_pairs.push({ key: vertices[i]._key, hash: utilities.sha3({ identifiers: vertices[i].identifiers, data: vertices[i].data }) }); // eslint-disable-line max-len
                }

                const tree = new Mtree(hash_pairs);
                const root_hash = tree.root();

                log.info(`Import id: ${data_id}`);
                log.info(`Import hash: ${root_hash}`);
                storage.storeObject(`Import_${data_id}`, { vertices: hash_pairs, root_hash }, (response) => {
                    // eslint-disable-next-line max-len
                    signing.signAndSend(data_id, utilities.sha3(data_id), utilities.sha3(tree.root())).then((response) => { // eslint-disable-line no-shadow
                        // eslint-disable-next-line global-require
                        const graph = require('./graph')();
                        // eslint-disable-next-line global-require
                        const testing = require('./testing')();

                        // eslint-disable-next-line max-len
                        graph.encryptVertices(config.DH_NODE_IP, config.DH_NODE_PORT, vertices, (result) => { // eslint-disable-line no-shadow
                            const encryptedVertices = result;
                            log.info('[DC] Preparing to enter sendPayload');

                            const data = {};
                            data.vertices = vertices;
                            data.edges = edges;
                            data.data_id = data_id;

                            // eslint-disable-next-line no-shadow
                            replication.sendPayload(data, (result) => {
                                log.info('[DC] Payload sent');
                                log.info('[DC] Generating tests for DH');
                            });
                        });
                    }).catch((err) => {
                        log.warn('Failed to write data fingerprint on blockchain!');
                    });
                });
            });
        },

    };

    return importer;
};

