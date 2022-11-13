import Web3Service from '../web3-service.js';

class PolygonService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'MATIC';
        this.tracTicker = 'mTRAC';
    }

    getBlockchainId() {
        return 'polygon';
    }
}

export default PolygonService;
