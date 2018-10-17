const Command = require('../command');
const Models = require('../../../models/index');

/**
 * Handles new offer from the DH side
 */
class DHOfferHandleCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.transport = ctx.transport;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            offerId,
            dcNodeId,
        } = command.data;

        this.logger.trace(`Sending replication request for offer ${offerId} to ${dcNodeId}.`);
        await this.transport.replicationRequest({
            offerId,
            wallet: this.config.node_wallet,
            dhIdentity: this.config.erc725Identity,
        }, dcNodeId);

        const bid = await Models.bids.findOne({
            where: { offer_id: offerId },
        });
        bid.status = 'SENT';
        await bid.save({ fields: ['status'] });

        this.logger.notify(`Replication request for ${offerId} sent to ${dcNodeId}`);
        return Command.empty();
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferHandleCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferHandleCommand;
