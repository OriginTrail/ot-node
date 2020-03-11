const Command = require('../command');
const Models = require('../../../models');
const { fork } = require('child_process');

/**
 * Increases approval for Bidding contract on blockchain
 */
class ExportCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.notifyError = ctx.notifyError;
    }

    async execute(command) {
        const {
            datasetId,
            handlerId,
        } = command.data;

        const forked = fork('modules/worker/export-worker.js');

        forked.send(JSON.stringify({
            datasetId, handlerId,
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
                            handlerId,
                        },
                    },
                );
            }
            forked.kill();
        });
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
        this.logger.info(`Export failed for export handler_id: ${handlerId}`);
        await Models.handler_ids.update(
            {
                status: 'FAILED',
                data: JSON.stringify({
                    error: error.message,
                }),
            },
            {
                where: {
                    handlerId,
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
