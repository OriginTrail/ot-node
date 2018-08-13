const Models = require('../../../models/index');
const Command = require('../command');
const BN = require('bn.js');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DCOfferReadyCommand extends Command {
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
            totalEscrowTime: data.totalEscrowTime.toString(),
            maxTokenAmount: data.maxTokenAmount.toString(),
            minStakeAmount: data.minStakeAmount.toString(),
            importSizeInBytes: data.importSizeInBytes.toString(),
        });
        return data;
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { importId, offerId } = command.data;
        this.logger.notify(`Offer ${importId} not finalized. Canceling offer.`);

        return {
            commands: [{
                name: 'dcOfferCancelCommand',
                data: {
                    importId,
                    offerId,
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
    default(map) {
        const command = {
            name: 'dcOfferReadyCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DCOfferReadyCommand;
