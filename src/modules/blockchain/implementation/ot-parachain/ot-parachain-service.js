const Web3Service = require('../web3-service');

class OtParachainService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'OTP';
        this.tracTicker = 'pTRAC';
    }
}

module.exports = OtParachainService;
