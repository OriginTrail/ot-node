// External modules
const Graph = require('./Graph');
const ImportUtilities = require('./ImportUtilities');
const Queue = require('better-queue');

class Importer {
    constructor(ctx) {
        this.gs1Importer = ctx.gs1Importer;
        this.wotImporter = ctx.wotImporter;
        this.graphStorage = ctx.graphStorage;
        this.log = ctx.logger;
        this.remoteControl = ctx.remoteControl;
        this.notifyError = ctx.notifyError;

        this.queue = new Queue((async (args, cb) => {
            const { type, data, future } = args;
            let response;
            if (type === 'JSON') {
                response = await this._importJSON(data);
            } else if (type === 'WOT_JSON_FILE') {
                response = await this._importWOT(data);
            } else if (type === 'GS1_XML_FILE') {
                response = await this._importXMLgs1(data);
            } else {
                future.reject(new Error(`Import type ${type} is not defined.`));
                return;
            }
            future.resolve(response);
            cb();
        }), { concurrent: 1 });
    }

    /**
     * Various types of import
     * @param type
     * @param data
     * @return {Promise<void>}
     * @private
     */
    _import(type, data) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                type,
                data,
                future: {
                    resolve, reject,
                },
            });
        });
    }

    async importJSON(json_document, packKeys = false) {
        try {
            const result = await this._import('JSON', {
                packKeys,
                json_document,
            });
            return {
                response: await this.afterImport(result, packKeys),
                error: null,
            };
        } catch (error) {
            this.log.error(`Import error: ${error}.`);
            this.notifyError(error);
            const errorObject = { message: error.toString(), status: error.status };
            return {
                response: null,
                error: errorObject,
            };
        }
    }

    async _importJSON(data) {
        this.log.info('Entering importJSON');
        const {
            packKeys,
            json_document,
        } = data;

        let {
            vertices,
            edges,
        } = json_document;

        const {
            import_id,
            wallet,
        } = json_document;

        this.log.trace('Import vertices and edges');
        ImportUtilities.deleteInternal(vertices);

        if (packKeys) {
            ImportUtilities.packKeys(vertices, edges);
        }

        vertices = await Promise.all(vertices.map(async (vertex) => {
            const inserted = await this.graphStorage.addVertex(vertex);
            vertex._key = inserted._key;
            return vertex;
        }));
        edges = await Promise.all(edges.map(async (edge) => {
            const inserted = await this.graphStorage.addEdge(edge);
            edge._key = inserted._key;
            return edge;
        }));

        // TODO: Use transaction here.
        await Promise.all(vertices.map(vertex => this.graphStorage.addVertex(vertex))
            .concat(edges.map(edge => this.graphStorage.addEdge(edge))));
        await Promise.all(vertices.map(vertex => this.graphStorage.updateImports('ot_vertices', vertex, import_id))
            .concat(edges.map(edge => this.graphStorage.updateImports('ot_edges', edge, import_id))));

        this.log.info('JSON import complete');

        return {
            vertices,
            edges,
            import_id,
            wallet,
        };
    }

    /**
     * Process successfull import
     * @param unpack  Unpack keys
     * @param result  Import result
     * @return {Promise<>}
     */
    async afterImport(result, unpack = false) {
        this.log.info('[DC] Import complete');
        this.remoteControl.importRequestData();
        let {
            vertices, edges,
        } = result;

        if (unpack) {
            ImportUtilities.unpackKeys(vertices, edges);
        }

        const {
            import_id, wallet,
        } = result;

        edges = Graph.sortVertices(edges);
        vertices = Graph.sortVertices(vertices);
        const importHash = ImportUtilities.importHash(vertices, edges);

        const merkle = await ImportUtilities.merkleStructure(vertices.filter(vertex =>
            vertex.vertex_type !== 'CLASS'), edges);

        this.log.info(`Import id: ${import_id}`);
        this.log.info(`Import hash: ${merkle.tree.getRoot()}`);
        return {
            import_id,
            root_hash: merkle.tree.getRoot(),
            import_hash: importHash,
            total_documents: merkle.hashPairs.length,
            vertices,
            edges,
            wallet,
        };
    }

    async importWOT(document) {
        return this._import('WOT_JSON_FILE', document);
    }

    async _importWOT(document) {
        try {
            const result = await this.wotImporter.parse(document);
            return {
                response: await this.afterImport(result),
                error: null,
            };
        } catch (error) {
            this.log.error(`Import error: ${error}.`);
            this.notifyError(error);
            const errorObject = { message: error.toString(), status: error.status };
            return {
                response: null,
                error: errorObject,
            };
        }
    }

    async importXMLgs1(document) {
        return this._import('GS1_XML_FILE', document);
    }

    async _importXMLgs1(ot_xml_document) {
        try {
            const result = await this.gs1Importer.parseGS1(ot_xml_document);
            return {
                response: await this.afterImport(result),
                error: null,
            };
        } catch (error) {
            this.log.error(`Import error: ${error}.`);
            this.notifyError(error);
            const errorObject = { message: error.toString(), status: error.status };
            return {
                response: null,
                error: errorObject,
            };
        }
    }
}

module.exports = Importer;

