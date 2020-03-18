const Command = require('../command');
const Models = require('../../../models');
const { fork } = require('child_process');
const Utilities = require('../../Utilities');
const fs = require('fs');
const path = require('path');
/**
 * Increases approval for Bidding contract on blockchain
 */
class ExportCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.notifyError = ctx.notifyError;
        this.importService = ctx.importService;
        this.config = ctx.config;
    }

    async execute(command) {
        const {
            datasetId,
            handlerId,
            standardId,
        } = command.data;

        const {
            vertices,
            edges,
            metadata,
        } = await this.importService.getImportDbData(datasetId);

        const forked = fork('modules/worker/export-worker.js');

        forked.send(JSON.stringify({
            datasetId,
            standardId,
            handlerId,
            config: this.config,
            vertices,
            edges,
            metadata,
        }));

        forked.on('message', async (response) => {
            if (response.error) {
                await this.handleError(handlerId, response.error);
            } else {
                this.logger.info(`Export complete for export handler_id: ${handlerId}`);
                await Models.handler_ids.update(
                    {
                        status: 'COMPLETED',
                    },
                    {
                        where: {
                            handler_id: handlerId,
                        },
                    },
                );
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
        if (error.type !== 'ExporterError') {
            this.notifyError(error);
        }
    }

    /**
     * Builds default exportCommand command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'exportCommand',
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ExportCommand;
