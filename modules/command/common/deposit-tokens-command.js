const BN = require('../../../node_modules/bn.js/lib/bn');

const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Deposits tokens on blockchain
 */
class DepositTokensCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.web3 = ctx.web3;
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
        this.logger.notify(`Deposit amount: ${amount} mTRAC.`);

        const blockchainIdentity = Utilities.normalizeHex(this.config.erc725Identity);
        await this._printBalances(blockchainIdentity, 'Old');
        await this.blockchain.depositTokens(blockchainIdentity, amount);
        await this._printBalances(blockchainIdentity, 'New');
        return this.continueSequence(this.pack(command.data), command.sequence);
    }

    /**
     * Print balances
     * @param blockchainIdentity
     * @param timeFrame string to describe before or after withdrawal operation
     * @return {Promise<void>}
     * @private
     */
    async _printBalances(blockchainIdentity, timeFrame) {
        const balance = await this.blockchain.getProfileBalance(this.config.node_wallet);
        const balanceInTRAC = this.web3.utils.fromWei(balance, 'ether');
        this.logger.info(`${timeFrame} wallet balance: ${balanceInTRAC} TRAC`);

        const profile = await this.blockchain.getProfile(blockchainIdentity);
        const profileBalance = profile.stake;
        const profileBalanceInTRAC = this.web3.utils.fromWei(profileBalance, 'ether');
        this.logger.info(`${timeFrame} profile balance: ${profileBalanceInTRAC} TRAC`);
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
            retries: 3,
            delay: 0,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = DepositTokensCommand;
