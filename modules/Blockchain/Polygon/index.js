const environment = process.env.NODE_ENV === 'mariner' ? 'mainnet' : process.env.NODE_ENV;

const Web3Implementation = require('../Web3Implementation');
const path = require('path');
const axios = require('axios');
const constants = require('../../constants');


const coinGeckoLink = 'https://api.coingecko.com/api/v3/simple/price?ids=origintrail,matic-network&vs_currencies=usd';
const gasStationLinks = {
    testnet: 'https://gasstation-mumbai.matic.today/',
    mainnet: 'https://gasstation-mainnet.matic.network/',
};


class Polygon extends Web3Implementation {
    /**
     * Initializing Polygon blockchain connector
     */
    constructor({ config, emitter, logger }, configuration) {
        super({
            config,
            emitter,
            logger,
            contractPath: path.join(__dirname, 'abi'),
        }, configuration);

        this.logger.info(`[${this.getBlockchainId()}] Selected blockchain: Polygon`);
    }

    async getRelativeTracPrice() {
        const response = await axios.get(coinGeckoLink);
        if (response) {
            return response.data.origintrail.usd / response.data['matic-network'].usd;
        }
        return undefined;
    }

    async getGasPrice(urgent = false) {
        const gasPrice = await this.calculateGasPrice();
        if (gasPrice > this.config.max_allowed_gas_price && !urgent) {
            throw new Error(`[${this.getBlockchainId()}] Gas price higher than maximum allowed price`);
        } else {
            return gasPrice;
        }
    }

    async calculateGasPrice() {
        const now = new Date().getTime();

        if (environment === 'development' || (this.config.gas_price_last_update_timestamp
            + constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS > now)) {
            this.logger.trace(`[${this.getBlockchainId()}] Using default gas price from `
                + `configuration: ${this.config.gas_price}`);

            return this.config.gas_price;
        }

        let gasPrice = await this.getGasStationPrice()
            .catch((err) => { this.logger.warn(err); }) * constants.AVERAGE_GAS_PRICE_MULTIPLIER;
        gasPrice = Math.round(gasPrice);

        if (gasPrice) {
            this.logger.trace(`[${this.getBlockchainId()}] Using gas price from gas station service: ${gasPrice}`);

            this.saveNewGasPriceAndTime(gasPrice);
            return gasPrice;
        }

        this.logger.trace(`[${this.getBlockchainId()}] Using gas price from configuration: `
            + `${this.config.gas_price}`);

        return this.config.gas_price;
    }

    async getGasStationPrice() {
        const response = await axios.get(gasStationLinks[environment])
            .catch((err) => {
                this.logger.warn(err);
                return undefined;
            });
        if (response) {
            return response.data.standard * 1000000000;
        }
        return undefined;
    }

    saveNewGasPriceAndTime(gasPrice) {
        this.config.gas_price = gasPrice;
        this.config.gas_price_last_update_timestamp = new Date().getTime();
    }
}

module.exports = Polygon;
