const Command = require('../command');
const Models = require('../../../models');
const bytes = require('utf8-length');
const Utilities = require('../../Utilities');
const { sha3_256 } = require('js-sha3');
const ImportUtilities = require('../../ImportUtilities');
const Graph = require('../../Graph');

class DcFinalizeImport extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const data = command.data.afterImportData;
        const response = await this._unpackKeysAndSortVertices(data);
        response.handler_id = data.afterImportData.handler_id;

        await this._finalizeImport(response);
        return Command.empty();
    }

    /**
     * Builds default dcOfferCreateDbCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcFinalizeImportCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }

    async _finalizeImport(response, error) {
        const { handler_id } = response;
        if (error != null) {
            await Models.handler_ids.update(
                {
                    status: 'FAILED',
                    data: JSON.stringify({
                        error: error.message,
                    }),
                },
                {
                    where: {
                        handler_id,
                    },
                },
            );
            this.remoteControl.importFailed(error);

            if (error.type !== 'ImporterError') {
                this.notifyError(error);
            }
            return;
        }

        const {
            data_set_id,
            root_hash,
            total_documents,
            wallet, // TODO: Sender's wallet is ignored for now.
            vertices,
            edges,
            otjson_size,
        } = response;

        try {
            const dataSize = bytes(JSON.stringify(vertices));
            const importTimestamp = new Date();
            const graphObject = {};
            Object.assign(graphObject, { vertices, edges });
            const dataHash = Utilities.normalizeHex(sha3_256(`${graphObject}`));
            await Models.data_info
                .create({
                    data_set_id,
                    root_hash,
                    data_provider_wallet: this.config.node_wallet,
                    import_timestamp: importTimestamp,
                    total_documents,
                    data_size: dataSize,
                    origin: 'IMPORTED',
                    otjson_size_in_bytes: otjson_size,
                    data_hash: dataHash,
                }).catch(async (error) => {
                    this.logger.error(error);
                    this.notifyError(error);
                    await Models.handler_ids.update(
                        {
                            status: 'FAILED',
                            data: JSON.stringify({
                                error,
                            }),
                        },
                        {
                            where: {
                                handler_id,
                            },
                        },
                    );
                    this.remoteControl.importFailed(error);
                });

            await Models.handler_ids.update(
                {
                    status: 'COMPLETED',
                    data: JSON.stringify({
                        dataset_id: data_set_id,
                        import_time: importTimestamp.valueOf(),
                        dataset_size_in_bytes: dataSize,
                        otjson_size_in_bytes: otjson_size,
                        root_hash,
                        data_hash: dataHash,
                        total_graph_entities: vertices.length
                                    + edges.length,
                    }),
                },
                {
                    where: {
                        handler_id,
                    },
                },
            );
            this.logger.info('Import complete');
            this.logger.info(`Root hash: ${root_hash}`);
            this.logger.info(`Data set ID: ${data_set_id}`);
            this.remoteControl.importSucceeded();
        } catch (error) {
            this.logger.error(`Failed to register import. Error ${error}.`);
            this.notifyError(error);
            await Models.handler_ids.update(
                {
                    status: 'FAILED',
                    data: JSON.stringify({
                        error,
                    }),
                },
                {
                    where: {
                        handler_id,
                    },
                },
            );
            this.remoteControl.importFailed(error);
        }
    }

    /**
     * Process successfull import
     * @param unpack  Unpack keys
     * @param result  Import result
     * @return {Promise<>}
     */
    _unpackKeysAndSortVertices(result, unpack = false) {
        this.remoteControl.importRequestData();
        const {
            data_set_id, wallet, root_hash,
        } = result.afterImportData;
        let {
            vertices, edges,
        } = result.afterImportData;
        if (unpack) {
            ImportUtilities.unpackKeys(vertices, edges);
        }

        edges = Graph.sortVertices(edges);
        vertices = Graph.sortVertices(vertices);

        return {
            data_set_id,
            root_hash,
            total_documents: edges.length + vertices.length,
            vertices,
            edges,
            wallet,
        };
    }
}

module.exports = DcFinalizeImport;
