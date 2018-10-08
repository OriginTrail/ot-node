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

        this.logger.info(`New offer has been created by ${dcNodeId}. Offer ID ${offerId}.`);

        // TODO check for parameters

        await Models.bids.create({
            offer_id: offerId,
            dc_node_id: dcNodeId,
        });

        await this.transport.replicationRequest({
            offerId,
            wallet: this.config.node_wallet,
        }, dcNodeId);
        this.logger.info(`Replication request for ${offerId} sent to ${dcNodeId}`);
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
