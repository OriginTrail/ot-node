// External modules
const Graph = require('./Graph');
const ImportUtilities = require('./ImportUtilities');
const Queue = require('better-queue');
const graphConverter = require('./Database/graph-converter');
const Utilities = require('./Utilities');

class Importer {
    constructor(ctx) {
        this.gs1Importer = ctx.gs1Importer;
        this.wotImporter = ctx.wotImporter;
        this.graphStorage = ctx.graphStorage;
        this.log = ctx.logger;
        this.remoteControl = ctx.remoteControl;
        this.notifyError = ctx.notifyError;
        this.helper = ctx.gs1Utilities;

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

    /**
     * Import dataset in JSON format
     * @param jsonDocument - Dataset document
     * @param packKeys - Pack or not
     * @param encColor - Encrypted color used when packing
     * @return {Promise<*>}
     */
    async importJSON(jsonDocument, packKeys = false, encColor = null) {
        try {
            const result = await this._import('JSON', {
                encColor,
                packKeys,
                jsonDocument,
            });
            return {
                response: await this.afterImport(result, packKeys),
                error: null,
            };
        } catch (error) {
            this.log.error(`Import error: ${error}.`);
            this.remoteControl.importError(`Import error: ${error}.`);
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
            encColor,
            jsonDocument,
        } = data;

        const {
            vertices,
            edges,
        } = jsonDocument;

        const {
            dataSetId,
            wallet,
        } = jsonDocument;

        this.log.trace('Import vertices and edges');
        ImportUtilities.deleteInternal(edges);
        ImportUtilities.deleteInternal(vertices);

        if (packKeys) {
            ImportUtilities.packKeys(vertices, edges, encColor);
        }

        await Promise.all(vertices.map(async (vertex) => {
            const truncatedVertex = Utilities.copyObject(vertex);
            delete truncatedVertex.data;
            const inserted = await this.graphStorage.addVertex(truncatedVertex);
            vertex._key = inserted._key;
            return vertex;
        }));

        await Promise.all(edges.map(async (edge) => {
            const inserted = await this.graphStorage.addEdge(edge);
            edge._key = inserted._key;
            return edge;
        }));

        const denormalizedVertices = graphConverter.denormalizeGraph(
            dataSetId,
            vertices,
            edges,
        ).vertices;

        // TODO: Use transaction here.
        await Promise.all(denormalizedVertices.map(vertex => this.graphStorage.addVertex(vertex))
            .concat(edges.map(edge => this.graphStorage.addEdge(edge))));

        if (encColor == null) {
            // it's encrypted
            await Promise.all(vertices
                .filter(vertex => vertex.vertex_type !== 'CLASS')
                .map(vertex => this.graphStorage.updateImports('ot_vertices', vertex, dataSetId))
                .concat(edges.map(edge => this.graphStorage.updateImports('ot_edges', edge, dataSetId))));
        } else {
            // not encrypted
            await Promise.all(vertices
                .map(vertex => this.graphStorage.updateImports('ot_vertices', vertex, dataSetId))
                .concat(edges.map(edge => this.graphStorage.updateImports('ot_edges', edge, dataSetId))));
        }
        this.log.info('JSON import complete');

        if (!packKeys) {
            vertices.forEach(async (vertex) => {
                if (vertex.vertex_type === 'EVENT') {
                    if (vertex.data && vertex.data.categories.indexOf('Ownership') !== -1) {
                        let sender = '';
                        if (this.helper.ignorePattern(vertex.data.bizStep, 'urn:epcglobal:cbv:bizstep:') === 'shipping') {
                            sender = true;
                        } else {
                            sender = false;
                        }

                        let step = '';
                        if (sender) {
                            step = 'receiving';
                        } else {
                            step = 'shipping';
                        }
                        // eslint-disable-next-line
                        const connectingEventVertices = await this.graphStorage.findEvent(
                            vertex.sender_id,
                            vertex.data.partner_id,
                            vertex.data.extension.extension.documentId,
                            step,
                        );
                        if (connectingEventVertices.length > 0) {
                            await this.graphStorage.addEdge({
                                _key: this.helper.createKey('event_connection', vertex.sender_id, connectingEventVertices[0]._key, vertex._key),
                                _from: `${connectingEventVertices[0]._key}`,
                                _to: `${vertex._key}`,
                                edge_type: 'EVENT_CONNECTION',
                                transaction_flow: 'INPUT',
                            });
                            await this.graphStorage.addEdge({
                                _key: this.helper.createKey('event_connection', vertex.sender_id, vertex._key, connectingEventVertices[0]._key),
                                _from: `${vertex._key}`,
                                _to: `${connectingEventVertices[0]._key}`,
                                edge_type: 'EVENT_CONNECTION',
                                transaction_flow: 'OUTPUT',
                            });
                        }
                    }
                }
            });
        }

        return {
            vertices,
            edges,
            data_set_id: dataSetId,
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
            data_set_id, wallet,
        } = result;

        edges = Graph.sortVertices(edges);
        vertices = Graph.sortVertices(vertices);

        const merkle = await ImportUtilities.merkleStructure(vertices, edges);

        this.log.info(`Root hash: ${merkle.tree.getRoot()}`);
        this.log.info(`Data set ID: ${data_set_id}`);
        return {
            data_set_id,
            root_hash: merkle.tree.getRoot(),
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
            this.remoteControl.importError(`Import error: ${error}.`);
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
            this.log.error(`Import error: ${error}.\n${error.stack}`);
            this.remoteControl.importError(`Import error: ${error}.`);
            const errorObject = { type: error.name, message: error.toString(), status: 400 };
            return {
                response: null,
                error: errorObject,
            };
        }
    }
}

module.exports = Importer;

