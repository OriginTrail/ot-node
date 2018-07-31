const Command = require('../command');
const BN = require('../../../node_modules/bn.js/lib/bn');

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
                this.build('dhOfferBidAdded', this.pack(command.data), null),
            ],
        };
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            myStake: data.myStake.toString(10),
            myPrice: data.myPrice.toString(10),
            profileBalance: data.profileBalance.toString(10),
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
    recover(command, err) {
        this.logger.info('Bid not added, your bid was probably too late and the offer has been closed');
    }

    /**
     * Builds default AddCommand
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'dhOfferBidAdd',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DHOfferBidAddCommand;
