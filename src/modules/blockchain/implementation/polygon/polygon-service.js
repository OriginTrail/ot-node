const Web3Service = require('../web3-service');

class PolygonService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'MATIC';
        this.tracTicker = 'mTRAC';
    }
}

module.exports = PolygonService;
