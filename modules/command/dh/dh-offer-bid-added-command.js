const Command = require('../command');
const Models = require('../../../models/index');
const BN = require('bn.js');

/**
 * Checks whether bid is successfully added
 */
class DHOfferBidAddedCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     * @param transaction
     */
    async execute(command, transaction) {
        const {
            importId, myPrice, dcNodeId, totalEscrowTime,
            myStake, dataSizeBytes, predeterminedBid,
        } = command.data;

        const event = await Models.events.findOne({ where: { event: 'AddedBid', import_id: importId, finished: 0 }, transaction });
        if (event) {
            const eventData = JSON.parse(event.data);
            this.logger.info(`Bid for ${importId} successfully added`);

            const dcWallet = await this.blockchain.getDcWalletFromOffer(importId);
            await Models.bids.create({
                bid_index: eventData.bid_index,
                price: myPrice.toString(),
                import_id: importId,
                dc_wallet: dcWallet,
                dc_id: dcNodeId,
                total_escrow_time: totalEscrowTime.toString(),
                stake: myStake.toString(),
                data_size_bytes: dataSizeBytes.toString(),
                pd_bid: predeterminedBid,
            }, { transaction });

            return {
                commands: [
                    this.build('dhOfferFinalizedCommand', this.pack(command.data), null),
                ],
            };
        }
        return Command.repeat();
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            myStake: data.myStake.toString(),
            myPrice: data.myPrice.toString(),
            profileBalance: data.profileBalance.toString(),
        });
        return data;
    }

    /**
     * Unpack data from database
     * @param data
     * @returns {Promise<*>}
     */
    unpack(data) {
        const parsed = data;
        Object.assign(parsed, {
            myStake: new BN(data.myStake, 10),
            myPrice: new BN(data.myPrice, 10),
            profileBalance: new BN(data.profileBalance, 10),
        });
        return parsed;
    }

    /**
     * Execute strategy when event is too late
     * @param command
     */
    async expired(command) {
        const { importId } = command.data;
        this.logger.info(`Bid for ${importId} not added, your bid was probably too late and the offer has been closed`);
        return Command.empty();
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferBidAddedCommand',
            delay: 0,
            period: 5000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferBidAddedCommand;
