const Utilities = require('./Utilities');
const BN = require('bn.js');

class ProfileService {
    /**
     * Default constructor
     * @param ctx
     */
    constructor(ctx) {
        this.blockchain = ctx.blockchain;
        this.web3 = ctx.web3;
        this.remoteControl = ctx.remoteControl;
        this.config = ctx.config;
        this.logger = ctx.logger;
    }

    /**
     * Deposit token to profile
     * @param amount
     * @returns {Promise<void>}
     */
    async depositToken(amount) {
        const walletBalance = await Utilities.getAlphaTracTokenBalance(
            this.web3,
            this.blockchain.config.wallet_address,
            this.blockchain.config.token_contract_address,
        );

        if (amount > parseFloat(walletBalance)) {
            throw new Error(`Wallet balance: ${walletBalance} ATRAC`);
        }

        const mATRAC = this.web3.utils.toWei(amount.toString(), 'ether');

        await this.blockchain.increaseBiddingApproval(new BN(mATRAC));
        await this.blockchain.depositToken(new BN(mATRAC));

        this.logger.trace(`${amount} ATRAC deposited on you profile`);

        const balance = await this.blockchain.getProfileBalance(this.config.node_wallet);
        const balanceInATRAC = this.web3.utils.fromWei(balance, 'ether');
        this.logger.info(`Profile balance: ${balanceInATRAC} ATRAC`);
    }

    /**
     * Withdraw tokens from profile to wallet
     * @param amount
     * @returns {Promise<void>}
     */
    async withdrawToken(amount) {
        const profileBalance = await this.blockchain.getProfileBalance(this.config.node_wallet);
        const profileBalanceInATRAC = this.web3.utils.fromWei(profileBalance, 'ether');

        if (amount > parseFloat(profileBalanceInATRAC)) {
            throw new Error(`Profile balance: ${profileBalanceInATRAC} ATRAC`);
        }

        const mATRAC = this.web3.utils.toWei(amount.toString(), 'ether');

        await this.blockchain.withdrawToken(new BN(mATRAC));

        this.logger.trace(`${amount} ATRAC withdrawn to your wallet`);

        const balance = await this.blockchain.getProfileBalance(this.config.node_wallet);
        const balanceInATRAC = this.web3.utils.fromWei(balance, 'ether');
        this.logger.info(`Profile balance: ${balanceInATRAC} ATRAC`);
    }
}

module.exports = ProfileService;
