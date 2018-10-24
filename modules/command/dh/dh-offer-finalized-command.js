const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DhOfferFinalizedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { offerId } = command.data;

        const events = await Models.events.findAll({
            where: {
                event: 'OfferFinalized',
                finished: 0,
            },
        });
        if (events) {
            const event = events.find((e) => {
                const {
                    offerId: eventOfferId,
                } = JSON.parse(e.data);
                return offerId === eventOfferId;
            });
            if (event) {
                event.finished = true;
                await event.save({ fields: ['finished'] });

                this.logger.important(`Offer ${offerId} finalized`);

                const {
                    holder1,
                    holder2,
                    holder3,
                } = JSON.parse(event.data);

                const holders = [holder1, holder2, holder3].map(h => Utilities.normalizeHex(h));
                const bid = await Models.bids.findOne({ where: { offer_id: offerId } });

                if (holders.includes(Utilities.denormalizeHex(this.config.erc725Identity))) {
                    bid.status = 'CHOSEN';
                    this.logger.important(`I've been chosen for offer ${offerId}.`);
                } else {
                    bid.status = 'NOT_CHOSEN';
                    this.logger.important(`I haven't been chosen for offer ${offerId}.`);
                }
                await bid.save({ fields: ['status'] });
                return Command.empty();
            }
        }
        return Command.repeat();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { offerId } = command.data;

        this.logger.important(`I haven't been chosen for offer ${offerId}. Offer has not been finalized.`);
        const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
        bid.status = 'NOT_CHOSEN';
        await bid.save({ fields: ['status'] });
        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferFinalizedCommand',
            delay: 0,
            period: 10 * 1000,
            deadline_at: Date.now() + (10 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhOfferFinalizedCommand;
