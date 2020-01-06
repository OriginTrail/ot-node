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
        this.notifyError = ctx.notifyError;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { afterImportData, error, handler_id, documentPath } = command.data;
        if (error) {
            await this._processError(error, handler_id, documentPath);
            return Command.empty();
        }
        const response = await this._unpackKeysAndSortVertices(afterImportData);

        const {
            handler_id, otjson_size_in_bytes, total_documents, purchased,
        } = afterImportData;
        const {
            data_set_id,
            root_hash,
            wallet, // TODO: Sender's wallet is ignored for now.
            vertices,
            edges,
        } = response;

        try {
            const importTimestamp = new Date();
            const graphObject = {};
            Object.assign(graphObject, { vertices, edges });
            const dataHash = Utilities.normalizeHex(sha3_256(`${graphObject}`));
            await Models.data_info.create({
                data_set_id,
                root_hash,
                data_provider_wallet: this.config.node_wallet,
                import_timestamp: importTimestamp,
                total_documents,
                origin: purchased ? 'PURCHASED' : 'IMPORTED',
                otjson_size_in_bytes,
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
                        otjson_size_in_bytes,
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

            this._removeDocumentCache(documentPath);

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
        return Command.empty();
    }

    /**
     * Builds default dcFinalizeImportCommand
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

    async _processError(error, handlerId, documentPath) {
        this.logger.error(error.message);
        await Models.handler_ids.update(
            {
                status: 'FAILED',
                data: JSON.stringify({
                    error: error.message,
                }),
            },
            {
                where: {
                    handler_id: handlerId,
                },
            },
        );
        this.remoteControl.importFailed(error);

        this._removeDocumentCache(documentPath);

        if (error.type !== 'ImporterError') {
            this.notifyError(error);
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
        } = result;
        let {
            vertices, edges,
        } = result;
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

    /**
     * Removes the temporary document used as import cache file
     * @param documentPath path to cache file
     * @return undefined
     */
    _removeDocumentCache(documentPath) {
        if (fs.existsSync(documentPath)) {
            fs.unlink(documentPath);
        }
    }
}

module.exports = DcFinalizeImport;
