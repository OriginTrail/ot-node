const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DcOfferFinalizedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.replicationService = ctx.replicationService;
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
            const event = events.filter((e) => {
                const {
                    offerId: eventOfferId,
                } = JSON.parse(e.data);
                return offerId === eventOfferId;
            });
            if (event) {
                this.logger.important(`Offer ${offerId} finalized`);

                const offer = await Models.offers.findOne({ where: { offer_id: offerId } });
                offer.status = 'FINALIZED';
                offer.message = 'Offer has been finalized';
                await offer.save({ fields: ['status', 'message'] });

                await this.replicationService.deleteOfferDir(offer.id);
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
        this.logger.notify(`Offer ${offerId} has not been finalized.`);

        const offer = await Models.offers.findOne({ where: { id: offerId } });
        offer.status = 'FAILED';
        offer.message = `Offer for ${offerId} has not been finalized.`;
        await offer.save({ fields: ['status', 'message'] });

        await this.replicationService.deleteOfferDir(offer.id);
        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dcOfferFinalizedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DcOfferFinalizedCommand;
