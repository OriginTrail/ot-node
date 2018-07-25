const Models = require('../../../models/index');
const Command = require('../Command');
const BN = require('../../../node_modules/bn.js/lib/bn');

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
            return this.continueSequence(this.pack(command.data), command.sequence);
        }
        return Command.repeat();
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            totalEscrowTime: data.totalEscrowTime.toString(10),
            maxTokenAmount: data.maxTokenAmount.toString(10),
            minStakeAmount: data.minStakeAmount.toString(10),
            importSizeInBytes: data.importSizeInBytes.toString(10),
        });
        return data;
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
     * Unpack data from database
     * @param data
     * @returns {Promise<*>}
     */
    unpack(data) {
        const parsed = data;
        Object.assign(parsed, {
            totalEscrowTime: new BN(data.totalEscrowTime, 10),
            maxTokenAmount: new BN(data.maxTokenAmount, 10),
            minStakeAmount: new BN(data.minStakeAmount, 10),
            importSizeInBytes: new BN(data.importSizeInBytes, 10),
        });
        return parsed;
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
            period: 5000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OfferReadyCommand;
