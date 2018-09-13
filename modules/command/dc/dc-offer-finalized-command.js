const Models = require('../../../models/index');
const Command = require('../command');

/**
 * Checks whether offer is finalized from the DC side
 */
class DCOfferFinalizedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { importId, offerId } = command.data;

        const event = await Models.events.findOne({ where: { event: 'OfferFinalized', import_id: importId, finished: 0 } });
        if (event) {
            event.finished = true;
            await event.save({ fields: ['finished'] });

            const offer = await Models.offers.findOne({ where: { id: offerId } });

            const message = `Offer for import ${offer.import_id} finalized`;
            offer.status = 'FINALIZED';
            this.remoteControl.bidChosen(importId);
            this.remoteControl.offerFinalized(`Offer for import ${offer.import_id} finalized`, importId);
            offer.message = message;
            await offer.save({ fields: ['status', 'message'] });
            this.logger.info(message);
            return Command.empty();
        }
        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        const { offerId } = command.data;

        const offer = await Models.offers.findOne({ where: { id: offerId } });
        const message = `Failed to get offer for import ${offer.import_id}). ${err}.`;
        offer.status = 'FAILED';
        offer.message = message;
        await offer.save({ fields: ['status', 'message'] });
        this.logger.error(message);
        this.remoteControl.dcErrorHandling(message);
        return Command.empty();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { offerId } = command.data;

        this.logger.warn('OfferFinalized command expired.');
        const offer = await Models.offers.findOne({ where: { id: offerId } });
        offer.status = 'FAILED';
        offer.message = 'OfferFinalized command expired.';
        await offer.save({ fields: ['status', 'message'] });
    }

    /**
     * Builds default FinalizeOfferReadyCommand
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

module.exports = DCOfferFinalizedCommand;
