const Command = require('../command');
const BN = require('../../../node_modules/bn.js/lib/bn');

/**
 * Increases approval for Profile contract on blockchain
 */
class ProfileApprovalIncreaseCommand extends Command {
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
        const { amount } = command.data;
        this.logger.notify(`Giving approval to profile contract for amount [${amount}].`);

        await this.blockchain.increaseProfileApproval(amount);
        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    /**
     * Pack data for DB
     * @param data
     */
    pack(data) {
        Object.assign(data, {
            amount: data.amount.toString(),
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
            amount: new BN(data.amount, 10),
        });
        return parsed;
    }

    /**
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'profileApprovalIncreaseCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = ProfileApprovalIncreaseCommand;
