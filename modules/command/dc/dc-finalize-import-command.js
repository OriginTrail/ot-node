const fs = require('fs');
const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');
const constants = require('../../constants');

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
        const {
            error,
            handler_id,
            data_set_id,
            data_provider_wallet,
            purchased,
            documentPath,
            root_hash,
            data_hash,
            otjson_size_in_bytes,
            total_documents,
        } = command.data;


        const promises = [];

        const document = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));
        document.vertices.forEach((vertex) => {
            if (vertex.vertexType === 'Data') {
                for (const private_data_array of constants.PRIVATE_DATA_OBJECT_NAMES) {
                    if (Array.isArray(vertex.data[private_data_array])) {
                        let has_private_data = false;
                        for (const private_data_element of vertex.data[private_data_array]) {
                            if (private_data_element.isPrivate) {
                                has_private_data = true;
                                promises.push(Models.private_data.create({
                                    data_set_id,
                                    element_id: vertex._key,
                                }));
                                break;
                            }
                        }
                        if (has_private_data) {
                            break;
                        }
                    }
                }
            }
        });

        await Promise.all(promises);

        await Utilities.deleteDirectory(documentPath);

        if (error) {
            await this._processError(error, handler_id, documentPath);
            return Command.empty();
        }

        try {
            const import_timestamp = new Date();
            this.remoteControl.importRequestData();
            await Models.data_info.create({
                data_set_id,
                root_hash,
                data_provider_wallet: data_provider_wallet || this.config.node_wallet,
                import_timestamp,
                total_documents,
                origin: purchased ? 'PURCHASED' : 'IMPORTED',
                otjson_size_in_bytes,
                data_hash,
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
                        import_time: import_timestamp.valueOf(),
                        otjson_size_in_bytes,
                        root_hash,
                        data_hash,
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

        if (error.type !== 'ImporterError') {
            this.notifyError(error);
        }
    }
}

module.exports = DcFinalizeImport;
