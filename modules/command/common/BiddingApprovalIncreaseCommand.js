const Command = require('../Command');
const BN = require('../../../node_modules/bn.js/lib/bn');

class BiddingApprovalIncreaseCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { condition, profileBalance } = command.data;
        await this.blockchain.increaseBiddingApproval(condition.sub(profileBalance));
        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            myStake: data.myStake.toString(10),
            myPrice: data.myPrice.toString(10),
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
        });
        return parsed;
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    static buildDefault(map) {
        const command = {
            name: 'biddingApprovalIncrease',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = BiddingApprovalIncreaseCommand;
