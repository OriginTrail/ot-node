const Command = require('../command');
const Utilities = require('../../Utilities');

/**
 * Starts token withdrawal operation
 */
class TokenWithdrawalCommand extends Command {
    constructor(ctx) {
        super(ctx);
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.web3 = ctx.web3;
        this.blockchain = ctx.blockchain;
        this.remoteControl = ctx.remoteControl;
    }

    /**
     * Executes command and produces one or more events
     * @param command
     */
    async execute(command) {
        const {
            amount,
        } = command.data;

        const blockchainIdentity = Utilities.normalizeHex(this.config.erc725Identity);
        await this._printBalances(blockchainIdentity, "Old");
        await this.blockchain.withdrawTokens(blockchainIdentity);
        this.logger.important(`Token withdrawal for amount ${amount} completed.`);
        await this._printBalances(blockchainIdentity, "New");
        return Command.empty();
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
     * Builds default command
     * @param map
     * @returns {{add, data: *, delay: *, deadline: *}}
     */
    default(map) {
        const command = {
            name: 'tokenWithdrawalCommand',
            delay: 30000,
            retries: 3,
            transactional: false,
        };
        Object.assign(command, map);
        return command;
    }
}

module.exports = TokenWithdrawalCommand;
