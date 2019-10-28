const Command = require('../command');
const { forEachSeries } = require('p-iteration');
const Utilities = require('../../Utilities');
const { sha3_256 } = require('js-sha3');

class DcWriteToDbCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.graphStorage = ctx.graphStorage;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        await this.writeToDb({
            data: command.data.dbData,
        });
        const data = {};
        Object.assign(data, {
            afterImportData: command.data,
        });
        return this.continueSequence(data, command.sequence);
    }

    /**
     * Builds default dcOfferCreateDbCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcWriteToDbCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

    async writeToDb(data) {
        const {
            vertices, edges, metadata, datasetId, header, dataCreator,
        } = data.data;

        await forEachSeries(vertices, vertex => this.graphStorage.addVertex(vertex));
        await forEachSeries(edges, edge => this.graphStorage.addEdge(edge));

        await forEachSeries(vertices.filter(vertex => vertex.vertexType === 'Connector'), async (vertex) => {
            // Connect to other connectors if available.
            const relatedConnectors = await this.graphStorage.findConnectors(vertex.connectionId);

            await forEachSeries(
                relatedConnectors.filter(v => v._key !== vertex._key),
                async (relatedVertex) => {
                    // Check if there is connection is expected and if so check connection.
                    if (relatedVertex.expectedConnectionCreators != null) {
                        let hasConnection = false;
                        relatedVertex.expectedConnectionCreators.forEach((expectedCreator) => {
                            const expectedErc725 = this._value(expectedCreator);

                            if (dataCreator === expectedErc725) {
                                hasConnection = true;
                            }
                        });

                        if (!hasConnection) {
                            // None of mentioned pointed to data creator.
                            this.log.warn(`Dataset ${datasetId} has invalid connectors (${vertex.connectionId}).`);
                            return;
                        }
                    }

                    await this.graphStorage.addEdge({
                        _key: this._keyFrom(dataCreator, vertex._key, relatedVertex._key),
                        _from: vertex._key,
                        _to: relatedVertex._key,
                        relationType: 'CONNECTION_DOWNSTREAM',
                        edgeType: 'ConnectorRelation',
                    });

                    // Other way. This time host node is the data creator.
                    await this.graphStorage.addEdge({
                        _key: this._keyFrom(this.me, relatedVertex._key, vertex._key),
                        _from: relatedVertex._key,
                        _to: vertex._key,
                        relationType: 'CONNECTION_DOWNSTREAM',
                        edgeType: 'ConnectorRelation',
                    });
                },
            );
        });

        await this.graphStorage.addDatasetMetadata(metadata);
    }

    /**
     * Calculate SHA3 from input objects and return normalized hex string.
     * @param rest An array of input data concatenated before calculating the hash.
     * @return {string} Normalized hash string.
     * @private
     */
    _keyFrom(...rest) {
        return Utilities.normalizeHex(sha3_256([...rest].reduce(
            (acc, argument) => {
                acc += Utilities.stringify(argument, 0);
                return acc;
            },
            '',
        )));
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

module.exports = DcWriteToDbCommand;
