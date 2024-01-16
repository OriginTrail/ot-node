import axios from 'axios';
import Web3Service from '../web3-service.js';
import { BLOCK_TIME_MILLIS, GNOSIS_DEFAULT_GAS_PRICE } from '../../../../constants/constants.js';

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
                gasPrice = Number(response.data.result, 10);
            } else if (this.config.name.split(':')[1] === '10200') {
                gasPrice = Math.round(response.data.average * 1e9);
            }
            this.logger.debug(`Gas price on Gnosis: ${gasPrice}`);
            return gasPrice;
        } catch (error) {
            this.logger.warn(
                `Failed to fetch the gas price from the Gnosis: ${error}. Using default value: ${GNOSIS_DEFAULT_GAS_PRICE} Gwei.`,
            );
            this.convertToWei(GNOSIS_DEFAULT_GAS_PRICE, 'gwei');
        }
    }

    async healthCheck() {
        try {
            const blockNumber = await this.getBlockNumber();
            if (blockNumber) return true;
        } catch (e) {
            this.logger.error(`Error on checking Gnosis blockchain. ${e}`);
            return false;
        }
        return false;
    }
}

export default GnosisService;
