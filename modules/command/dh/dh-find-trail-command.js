const Command = require('../command');
const Models = require('../../../models/index');
const Utilities = require('../../Utilities');
const fs = require('fs');
const path = require('path');

/**
 * Handles one data challenge
 */
class DHFindTrailCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.trailService = ctx.trailService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            handler_id,
            unique_identifiers,
            depth,
            reach,
            included_connection_types,
            excluded_connection_types,
        } = command.data;

        this.trailService.findTrail(
            unique_identifiers,
            depth,
            reach,
            included_connection_types,
            excluded_connection_types,
        ).then(async (response) => {
            const cacheDirectory = path.join(this.config.appDataPath, 'trail_cache');

            try {
                await Utilities.writeContentsToFile(
                    cacheDirectory,
                    handler_id,
                    JSON.stringify(response),
                );

                await Models.handler_ids.update(
                    {
                        status: 'COMPLETED',
                    },
                    {
                        where: {
                            handler_id,
                        },
                    },
                );
            } catch (e) {
                const filePath = path.join(cacheDirectory, handler_id);

                if (fs.existsSync(filePath)) {
                    await Utilities.deleteDirectory(filePath);
                }
                this.handleError(handler_id, e);
            }


            this.logger.info(`Trail completed for handler_id: ${handler_id}`);
        }).catch(async (error) => {
            await this.handleError(handler_id, error);
        });


        return Command.empty();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const {
            handler_id,
        } = command.data;

        await this.handleError(handler_id, err);

        return Command.retry();
    }

    async handleError(handler_id, error) {
        await Models.handler_ids.update(
            {
                data: JSON.stringify({ message: error.message }),
                status: 'FAILED',
            },
            {
                where: {
                    handler_id,
                },
            },
        );
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhFindTrailCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHFindTrailCommand;
