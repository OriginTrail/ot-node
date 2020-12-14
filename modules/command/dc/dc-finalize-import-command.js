const fs = require('fs');
const Command = require('../command');
const Models = require('../../../models');
const Utilities = require('../../Utilities');

class DcFinalizeImport extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
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
            data_provider_wallets,
            purchased,
            documentPath,
            root_hash,
            data_hash,
            otjson_size_in_bytes,
            total_documents,
        } = command.data;

        await Utilities.deleteDirectory(documentPath);

        if (error) {
            await this._processError(error, handler_id, documentPath);
            return Command.empty();
        }

        try {
            const { node_wallet } = this.blockchain.getWallet().response;

            let dataProviderWallets;
            if (!data_provider_wallets) {
                dataProviderWallets = this.blockchain.getAllWallets()
                    .map(elem => ({
                        blockchain_id: elem.blockchain_id,
                        wallet: Utilities.normalizeHex(elem.response.node_wallet),
                    }));
            } else {
                dataProviderWallets = data_provider_wallets;
            }

            const import_timestamp = new Date();
            this.remoteControl.importRequestData();
            await Models.data_info.create({
                data_set_id,
                root_hash,
                data_provider_wallets: JSON.stringify(dataProviderWallets),
                import_timestamp,
                total_documents,
                origin: purchased ? 'PURCHASED' : 'IMPORTED',
                otjson_size_in_bytes,
                data_hash,
            }).catch(async (error) => {
                this.logger.error(error);
                const handler = await Models.handler_ids.findOne({
                    where: { handler_id },
                });
                const data = JSON.parse(handler.data);
                if (data && data.readExport) {
                    data.import_status = 'FAILED';
                    handler.status = data.export_status === 'PENDING' ? 'PENDING' : 'FAILED';
                    handler.data = JSON.stringify(data);

                    await Models.handler_ids.update(
                        {
                            data: handler.data,
                            status: handler.status,
                        },
                        {
                            where: {
                                handler_id,
                            },
                        },
                    );
                } else {
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
                }
                this.remoteControl.importFailed(error);
            });
            const handler = await Models.handler_ids.findOne({
                where: { handler_id },
            });
            const data = JSON.parse(handler.data);
            if (data && data.readExport) {
                data.import_status = 'COMPLETED';
                data.root_hash = root_hash;
                data.data_hash = data_hash;
                handler.status = data.export_status;
                handler.data = JSON.stringify(data);

                await Models.handler_ids.update(
                    {
                        data: handler.data,
                        status: handler.status,
                    },
                    {
                        where: {
                            handler_id,
                        },
                    },
                );
            } else {
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
            }

            this.logger.info('Import complete');
            this.logger.info(`Root hash: ${root_hash}`);
            this.logger.info(`Data set ID: ${data_set_id}`);
            this.remoteControl.importSucceeded();
        } catch (error) {
            this.logger.error(`Failed to register import. Error ${error}.`);
            const handler = await Models.handler_ids.findOne({
                where: { handler_id },
            });
            const data = JSON.parse(handler.data);
            if (data && data.readExport) {
                data.import_status = 'FAILED';
                handler.status = data.export_status === 'PENDING' ? 'PENDING' : 'FAILED';
                handler.data = JSON.stringify(data);

                await Models.handler_ids.update(
                    {
                        data: handler.data,
                        status: handler.status,
                    },
                    {
                        where: {
                            handler_id,
                        },
                    },
                );
            } else {
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
            }
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
    }
}

module.exports = DcFinalizeImport;
