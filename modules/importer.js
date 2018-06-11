// External modules
const PythonShell = require('python-shell');
const utilities = require('./Utilities');
const MerkleTree = require('./Merkle');
const Graph = require('./Graph');
const ImportUtilities = require('./ImportUtilities');
const { Lock } = require('semaphore-async-await');

class Importer {
    constructor(ctx) {
        this.gs1Importer = ctx.gs1Importer;
        this.wotImporter = ctx.wotImporter;
        this.graphStorage = ctx.graphStorage;
        this.log = ctx.logger;
        this.lock = new Lock();
    }

    async importJSON(json_document) {
        this.log.info('Entering importJSON');
        const { vertices, edges, import_id } = json_document;

        this.log.trace('Vertex importing');

        await this.lock.acquire();
        // TODO: Use transaction here.
        await Promise.all(vertices.map(vertex => this.graphStorage.addVertex(vertex))
            .concat(edges.map(edge => this.graphStorage.addEdge(edge))));
        await Promise.all(vertices.map(vertex => this.graphStorage.updateImports('ot_vertices', vertex, import_id))
            .concat(edges.map(edge => this.graphStorage.updateImports('ot_edges', edge, import_id))));

        this.lock.release();

        this.log.info('JSON import complete');
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
                this.log.info(stderr);
                utilities.executeCallback(callback, {
                    message: 'Import failure',
                    data: [],
                });
                return;
            }
            this.log.info('[DC] Import complete');
            const result = JSON.parse(stdout);
            // eslint-disable-next-line  prefer-destructuring
            const vertices = result.vertices;

            // eslint-disable-next-line  prefer-destructuring
            const edges = result.edges;
            const { import_id } = result;

            const leaves = [];
            const hash_pairs = [];

            for (const i in vertices) {
                // eslint-disable-next-line max-len
                leaves.push(utilities.sha3(utilities.sortObject({ identifiers: vertices[i].identifiers, data: vertices[i].data })));
                // eslint-disable-next-line no-underscore-dangle
                hash_pairs.push({ key: vertices[i]._key, hash: utilities.sha3({ identifiers: vertices[i].identifiers, data: vertices[i].data }) }); // eslint-disable-line max-len
            }

            const tree = new MerkleTree(hash_pairs);
            const root_hash = tree.root();

            this.log.info(`Import id: ${import_id}`);
            this.log.info(`Import hash: ${root_hash}`);

            utilities.executeCallback(callback, {
                message: 'Import success',
                data: [],
            });
        });
    }

    /**
     * Process successfull import
     * @param result  Import result
     * @return {Promise<>}
     */
    async afterImport(result) {
        this.log.info('[DC] Import complete');

        let {
            vertices, edges,
        } = result;

        const {
            import_id, wallet,
        } = result;

        edges = Graph.sortVertices(edges);
        vertices = Graph.sortVertices(vertices);
        const merkle = await ImportUtilities.merkleStructure(vertices, edges);

        this.log.info(`Import id: ${import_id}`);
        this.log.info(`Import hash: ${merkle.tree.getRoot()}`);
        return {
            import_id,
            root_hash: merkle.tree.getRoot(),
            total_documents: merkle.hashPairs.length,
            vertices,
            edges,
            wallet,
        };
    }

    async importWOT(document) {
        try {
            await this.lock.acquire();
            const result = await this.wotImporter.parse(document);
            this.lock.release();
            return await this.afterImport(result);
        } catch (error) {
            this.log.error(`Import error: ${error}.`);
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
            this.log.error(`Import error: ${error}.`);
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

