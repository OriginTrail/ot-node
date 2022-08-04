const Web3Service = require('../web3-service');

class OtParachainService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'OTP';
        this.tracTicker = 'pTRAC';
    }

    async getGasPrice() {
        if (this.config.gasPriceOracleLink) return super.getGasPrice();

        try {
            return this.web3.eth.getGasPrice();
        } catch (error) {
            return undefined;
        }
    }
}

module.exports = OtParachainService;
