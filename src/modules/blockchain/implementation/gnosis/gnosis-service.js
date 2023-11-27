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
            const response = await axios.get(this.config.gasPriceOracleLink);
            let gasPrice;
            if (this.config.name.split(':')[1] === '100') {
                gasPrice = Number(response.result, 10);
            } else if (this.config.name.split(':')[1] === '10200') {
                gasPrice = Math.round(response.average * 1e9);
            }
            this.logger.debug(`Gas price on Gnosis: ${gasPrice}`);
            return gasPrice;
        } catch (error) {
            return undefined;
        }
    }
}

export default GnosisService;
