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
            const defaultGasPrice =
                process.env.NODE_ENV === NODE_ENVIRONMENTS.MAINNET
                    ? GNOSIS_DEFAULT_GAS_PRICE.MAINNET
                    : GNOSIS_DEFAULT_GAS_PRICE.TESTNET;
            this.logger.warn(
                `Failed to fetch the gas price from the Gnosis: ${error}. Using default value: ${defaultGasPrice} Gwei.`,
            );
            this.convertToWei(defaultGasPrice, 'gwei');
        }
    }

    async getLatestTokenId(assetContractAddress) {
        const assetStorageContractInstance =
            this.assetStorageContracts[assetContractAddress.toString().toLowerCase()];
        if (!assetStorageContractInstance)
            throw new Error('Unknown asset storage contract address');

        const lastTokenId = await this.callContractFunction(
            assetStorageContractInstance,
            'lastTokenId',
            [],
        );
        return lastTokenId;
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
