const Command = require('../command');
const Utilities = require('../../Utilities');
const Models = require('../../../models/index');
const constants = require('../../constants');

/**
 * Repeatable command that checks whether offer is ready or not
 */
class DhOfferFinalizedCommand extends Command {
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
                return Utilities.compareHexStrings(offerId, eventOfferId);
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

                if (holders.includes(Utilities.normalizeHex(this.config.erc725Identity))) {
                    bid.status = 'CHOSEN';
                    await bid.save({ fields: ['status'] });
                    this.logger.important(`I've been chosen for offer ${offerId}.`);

                    // await this.remoteControl.onCompletedBids();

                    if (this.config.disableAutoPayouts !== true) {
                        const scheduledTime =
                            (bid.holding_time_in_minutes * 60 * 1000) + (60 * 1000);
                        return {
                            commands: [
                                {
                                    name: 'dhPayOutCommand',
                                    delay: scheduledTime,
                                    period: constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS,
                                    retries: 3,
                                    transactional: false,
                                    data: {
                                        offerId,
                                        viaAPI: false,
                                    },
                                },
                            ],
                        };
                    }
                    return Command.empty();
                }

                bid.status = 'NOT_CHOSEN';
                await bid.save({ fields: ['status'] });
                this.logger.important(`I haven't been chosen for offer ${offerId}.`);
                // await this.remoteControl.onCompletedBids();
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

        this.logger.important(`Offer ${offerId} has not been finalized.`);
        const bid = await Models.bids.findOne({ where: { offer_id: offerId } });
        bid.status = 'NOT_CHOSEN';
        await bid.save({ fields: ['status'] });
        // await this.remoteControl.onCompletedBids();
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
            deadline_at: Date.now() + (6 * constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DhOfferFinalizedCommand;
