const Models = require('../../models');
const Command = require('../command/Command');

class WaitFinalizeOfferReadyCommand extends Command {
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

        const event = await Models.events.findOne({ where: { event: 'OfferFinalized', import_id: importId, finished: 0 }, transaction });
        if (event) {
            event.finished = true;
            await event.save({ fields: ['finished'], transaction });
            const offer = await Models.offers.findOne({ where: { id: offerId }, transaction });

            const message = `Offer for import ${offer.import_id} finalized`;
            offer.status = 'FINALIZED';
            this.remoteControl.bidChosen(importId);
            this.remoteControl.offerFinalized(`Offer for import ${offer.import_id} finalized`, importId);
            offer.message = message;
            await offer.save({ fields: ['status', 'message'], transaction });
            this.logger.info(message);
            return {
                commands: [],
            };
        }
        return Command.repeat();
    }

    /**
     * Recover system from failure
     * @param command
     * @param transaction
     * @param err
     */
    async recover(command, err, transaction) {
        const { externalId } = command.data;

        const offer = await Models.offers.findOne({ where: { external_id: externalId } });
        const message = `Failed to get offer for import ${offer.import_id}). ${err}.`;
        offer.status = 'FAILED';
        offer.message = message;
        await offer.save({ fields: ['status', 'message'], transaction });
        this.logger.error(message);
        this.remoteControl.dcErrorHandling(message);

        return {
            commands: [],
        };
    }

    /**
     * Execute strategy when event is too late
     * @param transaction
     * @param command
     */
    async expired(command, transaction) {
        this.logger('OfferFinalized expired');
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'waitOfferFinalized',
            delay: 0,
            interval: 1000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = WaitFinalizeOfferReadyCommand;
