import Web3Service from '../web3-service.js';

class BaseService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'ETH';
        this.tracTicker = 'TRAC';
    }

    async getGasPrice() {
        return this.provider.getGasPrice();
    }
}

export default BaseService;
