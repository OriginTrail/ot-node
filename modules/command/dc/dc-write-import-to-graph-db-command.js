const fs = require('fs');
const Command = require('../command');
const { forEachSeries } = require('p-iteration');
const Utilities = require('../../Utilities');
const ImportUtilities = require('../../ImportUtilities');
const { sha3_256 } = require('js-sha3');

class DcWriteImportToGraphDbCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        this.logger.info('Importing data to database');
        const {
            handler_id, documentPath,
        } = command.data;
        try {
            const { vertices, edges, metadata } = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));
            const dataCreatorIdentifiers =
                ImportUtilities.getDataCreatorIdentifiers(metadata.datasetHeader);

            await forEachSeries(vertices, vertex => this.graphStorage.addVertex(vertex));
            await forEachSeries(edges, edge => this.graphStorage.addEdge(edge));

            await forEachSeries(vertices.filter(vertex => vertex.vertexType === 'Connector'), async (vertex) => {
                const { identifierValue } = vertices.find(v => edges.filter(edge => edge._from === vertex._key && ['IDENTIFIED_BY'].includes(edge.relationType)).map(edge => edge._to).includes(v._key));
                const { data } = vertices.find(v => edges.filter(edge => edge._from === vertex._key && ['HAS_DATA'].includes(edge.relationType)).map(edge => edge._to).includes(v._key));
                // Connect to other connectors if available.

                const connectorIdentifierVertexKey = Utilities.keyFrom('id', identifierValue);
                const relatedConnectors =
                    await this.graphStorage.findConnectors(connectorIdentifierVertexKey);

                await forEachSeries(
                    relatedConnectors.filter(v => v._key !== vertex._key),
                    async (relatedVertex) => {
                        let hasConnection1 = false;
                        if (relatedVertex.expectedConnectionCreators != null) {
                            relatedVertex.expectedConnectionCreators.forEach((expectedCreator) => {
                                const expectedErc725 = this._value(expectedCreator);

                                if (dataCreatorIdentifiers
                                    .find(elem => elem.identifierValue === expectedErc725)) {
                                    hasConnection1 = true;
                                }
                            });
                        }

                        let hasConnection2 = false;
                        await Promise.all(relatedVertex.datasets
                            .map(datasetId => new Promise(async (accept, reject) => {
                                try {
                                    if (hasConnection2 === false) {
                                        const metadata = await this.graphStorage
                                            .findMetadataByImportId(datasetId);

                                        if (metadata && data.expectedConnectionCreators != null) {
                                            data.expectedConnectionCreators
                                                .forEach((expectedCreator) => {
                                                    const expectedErc725 =
                                                        this._value(expectedCreator);

                                                    if (metadata.datasetHeader.dataCreator
                                                        .identifiers.find(elem =>
                                                            elem.identifierValue === expectedErc725)
                                                    ) {
                                                        hasConnection2 = true;
                                                    }
                                                });
                                        }
                                    }
                                } catch (e) {
                                    // console.log(e);
                                } finally {
                                    accept();
                                }
                            })));

                        if (!hasConnection1 || !hasConnection2) {
                            this.logger.warn(`Invalid connectors (${identifierValue}).`);
                            return;
                        }

                        await this.graphStorage.addEdge({
                            _key: Utilities
                                .keyFrom(dataCreatorIdentifiers, vertex._key, relatedVertex._key),
                            _from: vertex._key,
                            _to: relatedVertex._key,
                            relationType: 'CONNECTION_DOWNSTREAM',
                            edgeType: 'ConnectorRelation',
                        });

                        await this.graphStorage.addEdge({
                            _key: Utilities
                                .keyFrom(dataCreatorIdentifiers, relatedVertex._key, vertex._key),
                            _from: relatedVertex._key,
                            _to: vertex._key,
                            relationType: 'CONNECTION_DOWNSTREAM',
                            edgeType: 'ConnectorRelation',
                        });
                    },
                );
            });

            await this.graphStorage.addDatasetMetadata(metadata);
        } catch (error) {
            await this.commandExecutor.add({
                name: 'dcFinalizeImportCommand',
                delay: 0,
                transactional: false,
                data: {
                    handler_id,
                    documentPath,
                    error: { message: error.message },
                },
            });
            return Command.empty();
        }
        return this.continueSequence(command.data, command.sequence);
    }

    /**
     * Builds default dcOfferCreateDbCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'DcWriteImportToGraphDbCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

    /**
     * Returns value of '@value' property.
     * @param jsonLdObject JSON-LD object.
     * @return {string}
     * @private
     */
    _value(jsonLdObject) {
        return jsonLdObject['@value'];
    }
}

module.exports = DcWriteImportToGraphDbCommand;
