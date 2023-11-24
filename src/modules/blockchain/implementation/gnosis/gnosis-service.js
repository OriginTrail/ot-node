import Web3Service from '../web3-service.js';
import { BLOCK_TIME_MILLIS } from '../../../../constants/constants.js';

class GnosisService extends Web3Service {
    constructor(ctx) {
        super(ctx);

        this.baseTokenTicker = 'GNO';
        this.tracTicker = 'TRAC';
    }

    getBlockTimeMillis() {
        return BLOCK_TIME_MILLIS.GNOSIS;
    }

    async getGasPrice() {
        if (this.config.gasPriceOracleLink) return super.getGasPrice();

        try {
            return this.provider.getGasPrice();
        } catch (error) {
            return undefined;
        }
    }
}

export default GnosisService;
