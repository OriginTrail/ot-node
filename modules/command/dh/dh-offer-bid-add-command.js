const Command = require('../command');
const BN = require('bn.js');

/**
 * Adds bid for offer
 */
class DHOfferBidAddCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
        this.logger = ctx.logger;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            importId,
        } = command.data;

        await this.blockchain.addBid(importId, this.config.identity);
        return {
            commands: [
                this.build('dhOfferBidAddedCommand', this.pack(command.data), null),
            ],
        };
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
     * Recover system from failure
     * @param command
     * @param err
     */
    async recover(command, err) {
        this.logger.warn('Trying to recover from dhOfferBidAddCommand.');

        if (err.toString().includes('Transaction has been reverted by the EVM')) {
            const {
                importId,
            } = command.data;

            // Check if we're too late for bid.
            const offer = await this.blockchain.getOffer(importId);

            if (offer[0] !== '0x0000000000000000000000000000000000000000') {
                if (!offer.active || offer.finalized) {
                    this.logger.warn(`Offer for ${importId} was already finalized or not active. Failed to add bid.`);
                    return;
                }
            }
        }

        throw err;
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferBidAddCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferBidAddCommand;
