import Web3Service from '../web3-service.js';
import { BLOCK_TIME_MILLIS } from '../../../../constants/constants.js';

class BaseService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'ETH';
        this.tracTicker = 'TRAC';
    }

    getBlockTimeMillis() {
        return BLOCK_TIME_MILLIS.BASE;
    }

    async getGasPrice() {
        return this.provider.getGasPrice();
    }

    async getAgreementScoreFunctionId() {
        return 2;
    }
}

export default BaseService;
