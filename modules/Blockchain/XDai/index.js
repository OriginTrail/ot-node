const Web3Implementation = require('../Web3Implementation');
const path = require('path');
const axios = require('axios');

const coinGeckoLink = 'https://api.coingecko.com/api/v3/simple/price?ids=origintrail&vs_currencies=usd';

class XDai extends Web3Implementation {
    /**
     * Initializing XDai blockchain connector
     */
    constructor({ config, emitter, logger }, configuration) {
        super({
            config,
            emitter,
            logger,
            contractPath: path.join(__dirname, 'abi'),
        }, configuration);

        this.logger.info(`[${this.getBlockchainId()}] Selected blockchain: xDai`);
    }

    async getRelativeTracPrice() {
        const response = await axios.get(coinGeckoLink);
        if (response) {
            return response.data.origintrail.usd;
        }
        return undefined;
    }

    async calculateGasPrice() {
        return this.config.gas_price;
    }

    async getGasPrice() {
        return this.config.gas_price;
    }
}

module.exports = XDai;
