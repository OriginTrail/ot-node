const Command = require('../command');
const models = require('../../../models/index');
const utilities = require('../../Utilities');

/**
 * Listens indefinitely for REPLACEMENT_STARTED event from blockchain
 */
class DHReplacementStartedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.dhService = ctx.dhService;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        try {
            const event = await models.events.findOne({
                limit: 1,
                where: {
                    event: 'ReplacementStarted',
                    finished: 0,
                },
            });

            if (event) {
                const {
                    offerId,
                    challengerIdentity,
                    litigationRootHash,
                } = JSON.parse(event.data);

                if (utilities.compareHexStrings(this.config.erc725Identity, challengerIdentity)) {
                    return Command.repeat();
                }

                event.finished = true;
                await event.save({ fields: ['finished'] });

                await this.dhService.handleReplacement(
                    offerId, challengerIdentity,
                    litigationRootHash,
                );
            }
        } catch (e) {
            this.logger.error(`Failed to process ReplacementStartedCommand command. ${e}`);
        }

        return Command.repeat();
    }

    /**
     * Builds default DHReplacementStartedCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhReplacementStartedCommand',
            data: {
            },
            delay: 0,
            period: 5000,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHReplacementStartedCommand;
