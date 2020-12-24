const Command = require('../command');
const Models = require('../../../models/index');

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

        const response = await this.trailService.findTrail(
            unique_identifiers,
            depth,
            reach,
            included_connection_types,
            excluded_connection_types,
        );

        await Models.handler_ids.update(
            {
                data: JSON.stringify(response),
                status: 'COMPLETED',
            },
            {
                where: {
                    handler_id,
                },
            },
        );

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

        await Models.handler_ids.update(
            {
                data: JSON.stringify({ message: err.message }),
                status: 'FAILED',
            },
            {
                where: {
                    handler_id,
                },
            },
        );

        return Command.retry();
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
