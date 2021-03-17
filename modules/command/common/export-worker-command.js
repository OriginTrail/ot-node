const Command = require('../command');
const Models = require('../../../models');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
/**
 * Increases approval for Bidding contract on blockchain
 */
class ExportWorkerCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    async execute(command) {
        const {
            datasetId,
            handlerId,
            standardId,
        } = command.data;

        const forked = fork('modules/worker/export-worker.js');

        forked.send(JSON.stringify({
            datasetId,
            standardId,
            handlerId,
            config: this.config,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                await this.handleError(handlerId, response.error);
            } else {
                const handler = await Models.handler_ids.findOne({
                    where: { handler_id: handlerId },
                });
                const data = JSON.parse(handler.data);

                const cacheDirectory = path.join(this.config.appDataPath, 'export_cache');
                const documentPath = path.join(cacheDirectory, handlerId);

                const { dc_node_wallets, data_creator } = JSON.parse(fs.readFileSync(documentPath, { encoding: 'utf-8' }));
                data.dc_node_wallets = dc_node_wallets;
                data.data_creator = data_creator;

                if (data.readExport) {
                    data.export_status = 'COMPLETED';
                    handler.status = data.import_status;
                    handler.data = JSON.stringify(data);

                    await Models.handler_ids.update(
                        {
                            data: handler.data,
                            status: handler.status,
                        },
                        {
                            where: {
                                handler_id: handlerId,
                            },
                        },
                    );
                } else {
                    handler.data = JSON.stringify(data);
                    await Models.handler_ids.update(
                        {
                            status: 'COMPLETED',
                            data: handler.data,
                        },
                        {
                            where: {
                                handler_id: handlerId,
                            },
                        },
                    );
                }
                this.logger.info(`Export complete for export handler_id: ${handlerId}`);
            }
            forked.kill();
        });


        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param error
     */
    async recover(command, error) {
        const { handlerId } = command.data;
        await this.handleError(handlerId, error);
        return Command.empty();
    }

    async handleError(handlerId, error) {
        this.logger.error(`Export failed for export handler_id: ${handlerId}, error: ${error}`);

        const handler = await Models.handler_ids.findOne({
            where: { handler_id: handlerId },
        });
        const data = JSON.parse(handler.data);
        if (data.readExport) {
            data.export_status = 'FAILED';
            handler.status = data.import_status === 'PENDING' ? 'PENDING' : 'FAILED';
            handler.data = JSON.stringify(data);

            await Models.handler_ids.update(
                {
                    data: handler.data,
                    status: handler.status,
                },
                {
                    where: {
                        handler_id: handlerId,
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
                        handler_id: handlerId,
                    },
                },
            );
        }
    }

    /**
     * Builds default exportWorkerCommand command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'exportWorkerCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ExportWorkerCommand;
