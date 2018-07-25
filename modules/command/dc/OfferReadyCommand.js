const Models = require('../../../models/index');
const Command = require('../Command');

class OfferReadyCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const { importId, offerId } = command.data;

        const event = await Models.events.findOne({ where: { event: 'FinalizeOfferReady', import_id: importId, finished: 0 }, transaction });
        if (event) {
            this.logger.trace(`Bidding completed for import ${importId}`);
            this.remoteControl.biddingComplete(importId);

            const offer = await Models.offers.findOne({ where: { id: offerId }, transaction });
            offer.status = 'FINALIZING';
            await offer.save({ fields: ['status'], transaction });
            return this.continueSequence(command.data, command.sequence);
        }
        return Command.repeat();
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { importId, externalId } = command.data;
        this.log.notify(`Offer ${importId} not finalized. Canceling offer.`);

        return {
            commands: [{
                name: 'cancelOffer',
                data: {
                    externalId,
                },
                parent: command.data.id,
            }],
        };
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'offerReady',
            delay: 0,
            interval: 1000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OfferReadyCommand;
