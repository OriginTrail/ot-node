const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Deposits tokens on blockchain
 */
class DepositTokensCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const { amount } = command.data;
        this.logger.notify(`Deposit amount: ${amount}.`);

        const blockchainIdentity = Utilities.normalizeHex(this.config.erc725Identity);
        await this.blockchain.depositTokens(blockchainIdentity, amount);
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
            name: 'depositTokensCommand',
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DepositTokensCommand;
