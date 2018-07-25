const Models = require('../../../models/index');
const Command = require('../Command');

class OfferBidAddedCommand extends Command {
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
            });

            const { data } = command;
            Object.assign(data, {
                side: 'DH',
            });
            return {
                commands: [
                    {
                        name: 'offerFinalized',
                        data,
                    },
                ],
            };
        }
        return Command.repeat();
    }

    /**
     * Execute strategy when event is too late
     * @param transaction
     * @param command
     */
    async expired(command) {
        const { importId } = command.data;
        this.logger.info(`Bid for ${importId} not added, your bid was probably too late and the offer has been closed`);

        return {
            commands: [],
        };
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'offerBidAdded',
            delay: 0,
            interval: 1000,
            transactional: true,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = OfferBidAddedCommand;
