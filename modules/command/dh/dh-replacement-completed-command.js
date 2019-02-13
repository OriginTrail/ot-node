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
                    && !Utilities.compareHexStrings(challengerIdentity, this.config.erc725Identity);
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                const {
                    chosenHolder,
                } = JSON.parse(event.data);

                if (Utilities.compareHexStrings(chosenHolder, this.config.erc725Identity)) {
                    this.logger.important(`Chosen as a replacement for offer ${offerId}.`);

                    const bid = await Models.bids.findOne({ where: { offer_id: offerId } });

                    bid.status = 'CHOSEN';
                    await bid.save({ fields: ['status'] });
                } else {
                    this.logger.important(`Not chosen as a replacement for offer ${offerId}.`);
                }

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
