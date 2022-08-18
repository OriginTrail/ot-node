const Web3Service = require('../web3-service');

class GanacheService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'GANACHE_TOKENS';
        this.tracTicker = 'gTRAC';
    }
}

module.exports = GanacheService;
