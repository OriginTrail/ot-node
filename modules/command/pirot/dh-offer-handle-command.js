const BN = require('bn.js');
const d3 = require('d3-format');

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
            dataSetSizeInBytes,
            holdingTimeInMinutes,
            litigationIntervalInMinutes,
            tokenAmountPerHolder,
        } = command.data;

        this.logger.info(`New offer has been created by ${dcNodeId}. Offer ID ${offerId}.`);

        const format = d3.formatPrefix(',.6~s', 1e6);
        const dhMinTokenPrice = new BN(this.config.dh_min_token_price, 10);
        const dhMaxHoldingTimeInMinutes = new BN(this.config.dh_max_holding_time_in_minutes, 10);
        const dhMinLitigationIntervalInMinutes =
            new BN(this.config.dh_min_litigation_interval_in_minutes, 10);

        const formatMaxPrice = format(tokenAmountPerHolder);
        const formatMyPrice = format(this.config.dh_min_token_price);

        if (dhMinTokenPrice.gt(new BN(tokenAmountPerHolder, 10))) {
            this.logger.info(`Offer ${offerId} too cheap for me.`);
            this.logger.info(`Maximum price offered ${formatMaxPrice}[mATRAC] per byte/min`);
            this.logger.info(`My price ${formatMyPrice}[mATRAC] per byte/min`);
            return Command.empty();
        }

        if (dhMaxHoldingTimeInMinutes.lt(new BN(holdingTimeInMinutes, 10))) {
            this.logger.info(`Holding time for the offer ${offerId} is greater than my holding time defined.`);
            return Command.empty();
        }

        if (dhMinLitigationIntervalInMinutes.gt(new BN(litigationIntervalInMinutes, 10))) {
            this.logger.info(`Litigation interval for the offer ${offerId} is lesser than the one defined in the config.`);
            return Command.empty();
        }

        await Models.bids.create({
            offer_id: offerId,
            dc_node_id: dcNodeId,
            data_size_in_bytes: dataSetSizeInBytes,
            litigation_interval_in_minutes: litigationIntervalInMinutes,
            token_amount: tokenAmountPerHolder,
            status: 'PENDING',
        });

        this.logger.trace(`Sending replication request for offer ${offerId} to ${dcNodeId}.`);
        await this.transport.replicationRequest({
            offerId,
            wallet: this.config.node_wallet,
            dhIdentity: this.config.erc725Identity,
        }, dcNodeId);
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
