/* eslint-disable import/extensions */
import Web3Service from '../web3-service.js';

class GanacheService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'GANACHE_TOKENS';
        this.tracTicker = 'gTRAC';
    }
}

export default GanacheService;
