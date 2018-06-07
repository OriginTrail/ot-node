// External modules
const PythonShell = require('python-shell');
const utilities = require('./Utilities');
const Mtree = require('./mtree')();
const { Lock } = require('semaphore-async-await');

const log = utilities.getLogger();

class Importer {
    constructor(ctx) {
        this.gs1Importer = ctx.gs1Importer;
        this.wotImporter = ctx.wotImporter;
        this.graphStorage = ctx.graphStorage;
        this.lock = new Lock();
    }

    async importJSON(json_document) {
        log.info('Entering importJSON');
        const { vertices, edges, import_id } = json_document;

        if (typeof import_id !== 'number') {
            throw Error(`Invalid import ID. ${import_id}.`);
        }

        log.trace('Vertex importing');

        await this.lock.acquire();
        // TODO: Use transaction here.
        await Promise.all(vertices.map(vertex => this.graphStorage.addVertex(vertex))
            .concat(edges.map(edge => this.graphStorage.addEdge(edge))));
        await Promise.all(vertices.map(vertex => this.graphStorage.updateImports('ot_vertices', vertex, import_id))
            .concat(edges.map(edge => this.graphStorage.updateImports('ot_edges', edge, import_id))));

        this.lock.release();

        log.info('JSON import complete');
    }

    // eslint-disable-next-line no-shadow
    async importXML(ot_xml_document, callback) {
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
    }

    async afterImport(result) {
        log.info('[DC] Import complete');

        const { vertices } = result;
        const { edges } = result;
        const { import_id } = result;

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

        log.info(`Import id: ${import_id}`);
        log.info(`Import hash: ${root_hash}`);
        return {
            data_id: import_id,
            root_hash,
            total_documents: hash_pairs.length,
            vertices,
            edges,
        };
    }

    async importWOT(document) {
        try {
            await this.lock.acquire();
            const result = await this.wotImporter.parse(document);
            this.lock.release();
            return await this.afterImport(result);
        } catch (error) {
            log.error(`Import error: ${error}.`);
            const errorObject = { message: error.toString(), status: error.status };
            return {
                response: null,
                error: errorObject,
            };
        } finally {
            this.lock.release();
        }
    }

    async importXMLgs1(ot_xml_document) {
        try {
            await this.lock.acquire();
            const result = await this.gs1Importer.parseGS1(ot_xml_document);
            return {
                response: await this.afterImport(result),
                error: null,
            };
        } catch (error) {
            log.error(`Import error: ${error}.`);
            const errorObject = { message: error.toString(), status: error.status };
            return {
                response: null,
                error: errorObject,
            };
        } finally {
            this.lock.release();
        }
    }
}

module.exports = Importer;

