import axios from 'axios';
import Web3Service from '../web3-service.js';
import {
    BLOCK_TIME_MILLIS,
    GNOSIS_DEFAULT_GAS_PRICE,
    NODE_ENVIRONMENTS,
} from '../../../../constants/constants.js';

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
        let gasPrice;
        try {
            const response = await axios.get(this.config.gasPriceOracleLink);
            if (response?.data?.average) {
                // Returnts gwei
                gasPrice = Number(response.data.average);
                this.logger.debug(`Gas price from Gnosis oracle link: ${gasPrice} gwei`);
            } else if (response?.data?.result) {
                // Returns wei
                gasPrice = Number(response.data.result, 10);
                this.logger.debug(`Gas price from Gnosis oracle link: ${gasPrice} wei`);
                return gasPrice;
            } else {
                throw Error(
                    `Gas price oracle: ${this.config.gasPriceOracleLink} returns gas price in unsupported format.`,
                );
            }
        } catch (error) {
            const defaultGasPrice =
                process.NODE_ENV === NODE_ENVIRONMENTS.MAINNET
                    ? GNOSIS_DEFAULT_GAS_PRICE.MAINNET
                    : GNOSIS_DEFAULT_GAS_PRICE.TESTNET;
            this.logger.warn(
                `Failed to fetch the gas price from the Gnosis: ${error}. Using default value: ${defaultGasPrice} Gwei.`,
            );
            gasPrice = defaultGasPrice;
        }
        return this.convertToWei(gasPrice, 'gwei');
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
