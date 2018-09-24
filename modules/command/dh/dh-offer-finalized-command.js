const Models = require('../../../models/index');
const Command = require('../command');

/**
 * Checks whether offer is finalized from the DH side
 */
class DHOfferFinalizedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.transport = ctx.transport;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { importId } = command.data;

        const event = await Models.events.findOne({ where: { event: 'OfferFinalized', import_id: importId, finished: 0 } });
        if (event) {
            event.finished = true;
            await event.save({ fields: ['finished'] });

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
            await this.transport.replicationRequest({
                import_id: importId,
                wallet: this.config.node_wallet,
            }, bid.dc_id);
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
        const { importId } = command.data;

        const bidModel = await Models.bids.findOne({ where: { import_id: importId } });
        const bid = bidModel.get({ plain: true });

        this.logger.warn(`Failed to send replication request to ${bid.dc_id}. ${err}`);
        // TODO Cancel bid here.
        this.remoteControl.replicationReqestFailed(`Failed to send replication request ${err}`);
    }

    /**
     * Builds default FinalizeOfferReadyCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferFinalizedCommand',
            delay: 0,
            period: 5000,
            deadline_at: Date.now() + (5 * 60 * 1000),
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferFinalizedCommand;
