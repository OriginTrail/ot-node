import axios from 'axios';
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
        try {
            this.logger.debug('Gas price:');
            const response = await axios.get(this.config.gasPriceOracleLink);
            this.logger.debug(response);
            const gasPriceRounded = Math.round(response.result * 1e9);
            return gasPriceRounded;
        } catch (error) {
            return undefined;
        }
    }
}

export default GnosisService;
