import Web3Service from '../web3-service.js';

class EthService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'ETH';
        this.tracTicker = 'TRAC';
    }
}

export default EthService;
