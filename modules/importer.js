// External modules
const PythonShell = require('python-shell');
const utilities = require('./Utilities');
const fs = require('fs');
const config = require('./Config');
const Mtree = require('./mtree')();
const Storage = require('./Storage');
const async = require('async');
const deasync = require('deasync-promise');
const GSdb = require('./GraphStorageInstance');
const replication = require('./Challenge');
const Transactions = require('./Blockchain/Ethereum/Transactions');
const gs1 = require('./gs1-importer')();
var Web3 = require('web3');

const log = utilities.getLogger();

module.exports = () => {
    const importer = {

        async importJSON(json_document) {
            log.info('Entering importJSON');
            const { vertices, edges, data_id } = json_document;

            if (typeof data_id !== 'number') {
                throw Error(`Invalid data ID. ${data_id}.`);
            }

            log.trace('Vertex importing');

            // TODO: Use transaction here.
            await Promise.all(vertices.map(vertex => GSdb.db.addDocument('ot_vertices', vertex))
                .concat(edges.map(edge => GSdb.db.addDocument('ot_edges', edge))));
            await Promise.all(vertices.map(vertex => GSdb.db.updateDocumentImports('ot_vertices', vertex, data_id))
                .concat(edges.map(edge => GSdb.db.updateDocumentImports('ot_edges', edge, data_id))));

            log.info('JSON import complete');
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

                utilities.executeCallback(callback, {
                    message: 'Import success',
                    data: [],
                });
            });
        },

        async importXMLgs1(ot_xml_document) {
            try {
                const result = await gs1.parseGS1(ot_xml_document);

                log.info('[DC] Import complete');

                const { vertices } = result.vertices;
                const { edges } = result.edges;
                const data_id = result.import_id;

                const leaves = [];
                const hash_pairs = [];

                for (const i in vertices) {
                    leaves.push(utilities.sha3(utilities.sortObject({
                        identifiers: vertices[i].identifiers,
                        data: vertices[i].data,
                    })));
                    hash_pairs.push({
                        key: vertices[i]._key,
                        hash: utilities.sha3({
                            identifiers: vertices[i].identifiers,
                            data: vertices[i].data,
                        }),
                    });
                }

                const tree = new Mtree(hash_pairs);
                const root_hash = utilities.sha3(tree.root());

                log.info(`Import id: ${data_id}`);
                log.info(`Import hash: ${root_hash}`);
                return {
                    data_id,
                    root_hash,
                    total_documents: hash_pairs.length,
                    vertices,
                    edges,
                };
            } catch (error) {
                log.error(`Failed to parse XML. Error ${error}.`);
                return null;
            }
        },
    };

    return importer;
};
