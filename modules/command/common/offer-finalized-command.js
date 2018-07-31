const Models = require('../../../models/index');
const Command = require('../command');

class FinalizeOfferReadyCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.network = ctx.network;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const { importId, offerId, side } = command.data;

        const event = await Models.events.findOne({ where: { event: 'OfferFinalized', import_id: importId, finished: 0 }, transaction });
        if (event) {
            event.finished = true;
            await event.save({ fields: ['finished'], transaction });

            if (side === 'DC') {
                const offer = await Models.offers.findOne({ where: { id: offerId }, transaction });

                const message = `Offer for import ${offer.import_id} finalized`;
                offer.status = 'FINALIZED';
                this.remoteControl.bidChosen(importId);
                this.remoteControl.offerFinalized(`Offer for import ${offer.import_id} finalized`, importId);
                offer.message = message;
                await offer.save({ fields: ['status', 'message'], transaction });
                this.logger.info(message);
                return Command.empty();
            }

            const eventModelBids = await Models.events.findAll({
                where:
                    {
                        event: 'BidTaken',
                        import_id: importId,
                    },
            });
            if (!eventModelBids) {
                // Probably contract failed since no event fired.
                this.logger.info(`BidTaken not received for offer ${importId}.`);
                return Command.empty();
            }

            let bidTakenEvent = null;
            for (const e of eventModelBids) {
                const eventBidData = JSON.parse(e.data);

                if (eventBidData.DH_wallet === this.config.node_wallet) {
                    bidTakenEvent = e;
                    break;
                }
            }

            if (!bidTakenEvent) {
                this.logger.info(`Bid not taken for offer ${importId}.`);
                this.remoteControl.bidNotTaken(`Bid not taken for offer ${importId}.`);
                return Command.empty();
            }

            const bidModel = await Models.bids.findOne({ where: { import_id: importId } });
            const bid = bidModel.get({ plain: true });
            this.remoteControl.replicationRequestSent(importId);
            await this.network.kademlia().replicationRequest(
                {
                    import_id: importId,
                    wallet: this.config.node_wallet,
                },
                bid.dc_id, (err) => {
                    if (err) {
                        this.logger.warn(`Failed to send replication request to ${bid.dc_id}. ${err}`);
                        // TODO Cancel bid here.
                        this.remoteControl.replicationReqestFailed(`Failed to send replication request ${err}`);
                    }
                },
            );
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
        if (command.data.side === 'DC') {
            const { offerId } = command.data;

            const offer = await Models.offers.findOne({ where: { id: offerId } });
            const message = `Failed to get offer for import ${offer.import_id}). ${err}.`;
            offer.status = 'FAILED';
            offer.message = message;
            await offer.save({ fields: ['status', 'message'] });
            this.logger.error(message);
            this.remoteControl.dcErrorHandling(message);
        }
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
            name: 'offerFinalized',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = FinalizeOfferReadyCommand;
