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

    async depositToken(amount) {
        const walletBalance = await Utilities.getAlphaTracTokenBalance(
            this.web3,
            this.blockchain.config.wallet_address,
            this.blockchain.config.token_contract_address,
        );

        if (amount > parseFloat(walletBalance)) {
            throw new Error('Insufficient funds on your wallet');
        }

        const mATRAC = this.web3.utils.toWei(amount.toString(), 'ether');

        await this.blockchain.increaseBiddingApproval(new BN(mATRAC));
        await this.blockchain.depositToken(new BN(mATRAC));

        this.logger.info(`${amount} ATRAC deposited on you profile`);

        const balance = await this.blockchain.getProfileBalance(this.config.node_wallet);
        const balanceInATRAC = this.web3.utils.fromWei(balance, 'ether');
        this.logger.info(`Profile balance: ${balanceInATRAC} ATRAC`);
    }
}

module.exports = ProfileService;
