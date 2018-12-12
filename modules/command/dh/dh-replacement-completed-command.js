const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Imports data for replication
 */
class DHReplacementCompleted extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            dcIdentity,
        } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'ReplacementCompleted',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                    challengerIdentity,
                } = JSON.parse(e.data);
                return Utilities.compareHexStrings(offerId, eventOfferId)
                    && Utilities.compareHexStrings(challengerIdentity, dcIdentity);
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                // TODO handle

                this.logger.important(`Replacement completed for offer ${offerId}.`);
                return Command.empty();
            }
        }
        return Command.repeat();
    }


    /**
     * Builds default
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhReplacementCompleted',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHReplacementCompleted;
