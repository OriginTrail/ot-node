const { fork } = require('child_process');

const { sha3_256 } = require('js-sha3');

const Utilities = require('../Utilities');
const ImportUtilities = require('../ImportUtilities');

// Helper functions.

/**
 * Returns value of '@id' property.
 * @param jsonLdObject JSON-LD object.
 * @return {string}
 * @private
 */
function _id(jsonLdObject) {
    return jsonLdObject['@id'];
}

/**
 * Returns value of '@type' property.
 * @param jsonLdObject JSON-LD object.
 * @return {string}
 * @private
 */
function _type(jsonLdObject) {
    return jsonLdObject['@type'];
}

/**
 * Returns value of '@value' property.
 * @param jsonLdObject JSON-LD object.
 * @return {string}
 * @private
 */
function _value(jsonLdObject) {
    return jsonLdObject['@value'];
}

/**
 * Returns value of '@graph' property.
 * @param OT-JSON document object.
 * @return [Object]
 * @private
 */
function _graph(document) {
    return document['@graph'];
}

/**
 * Calculate SHA3 from input objects and return normalized hex string.
 * @param rest An array of input data concatenated before calculating the hash.
 * @return {string} Normalized hash string.
 * @private
 */
function _keyFrom(...rest) {
    return Utilities.normalizeHex(sha3_256([...rest].reduce(
        (acc, argument) => {
            acc += Utilities.stringify(argument, 0);
            return acc;
        },
        '',
    )));
}

/**
 * Constants used in graph creation.
 * @type {{
 * relationType: {
 *  identifies: string, hasData: string, identifiedBy: string, connectionDownstream: string},
 *  vertexType: {
 *  entityObject: string, identifier: string, data: string, connector: string},
 * edgeType: {
 *  connectorRelation: string, dataRelation: string, otRelation: string,
 *  identifierRelation: string},
 * objectType: {
 *  otConnector: string, otObject: string}}}
 */
const constants = {
    vertexType: {
        entityObject: 'EntityObject',
        identifier: 'Identifier',
        data: 'Data',
        connector: 'Connector',
    },
    edgeType: {
        identifierRelation: 'IdentifierRelation',
        dataRelation: 'dataRelation',
        otRelation: 'otRelation',
        connectorRelation: 'ConnectorRelation',
    },
    objectType: {
        otObject: 'otObject',
        otConnector: 'otConnector',
    },
    relationType: {
        identifies: 'IDENTIFIES',
        identifiedBy: 'IDENTIFIED_BY',
        hasData: 'HAS_DATA',
        connectionDownstream: 'CONNECTION_DOWNSTREAM',
    },
};
Object.freeze(constants);


class ImportService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.emitter = ctx.emitter;
        this.blockchain = ctx.blockchain;
        this.web3 = ctx.web3;
        this.otJsonImporter = ctx.otJsonImporter;

        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Call miner process
     * @param task
     * @param wallets
     * @param difficulty
     * @param offerId
     */
    async sendToWorker(data) {
        const {
            document,
            handler_id,
            encryptedMap,
        } = data;

        // Extract wallet from signature.
        const wallet = ImportUtilities.extractDatasetSigner(
            document,
            this.web3,
        );

        await this.otJsonImporter._validate(document);

        const forked = fork('modules/worker/graph-converter-worker.js');

        forked.send(JSON.stringify({ document, encryptedMap, wallet, handler_id }), () => {
            console.log('Poslao detetu input.');
        });

        forked.on('message', async (response) => {
            console.log('Wuuhuuu, dete mi je mrtvo.');
            const parsedData = JSON.parse(response);
            const commandData = {
                parsedData,
            };

            Object.assign(commandData, {
                dbData: {
                    vertices: parsedData.vertices,
                    edges: parsedData.edges,
                    metadata: parsedData.metadata,
                    datasetId: parsedData.datasetId,
                    header: parsedData.header,
                    dataCreator: parsedData.dataCreator,
                },
                afterImportData: {
                    wallet: parsedData.wallet,
                    total_documents: parsedData.total_documents,
                    root_hash: parsedData.root_hash,
                    vertices: parsedData.deduplicateEdges,
                    edges: parsedData.deduplicateVertices,
                    data_set_id: parsedData.datasetId,
                    handler_id: parsedData.handler_id,
                },
            });

            const commandSequence = [
                'dcWriteToDbCommand',
                'dcAfterImportCommand',
            ];

            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        });
    }
}

module.exports = ImportService;
