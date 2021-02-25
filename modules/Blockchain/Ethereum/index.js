const path = require('path');
const axios = require('axios');

const Web3Implementation = require('../Web3Implementation');
const constants = require('../../constants');

const coinGeckoLink = 'https://api.coingecko.com/api/v3/simple/price?ids=origintrail&vs_currencies=eth';
const gasStationLink = 'https://ethgasstation.info/json/ethgasAPI.json';

class Ethereum extends Web3Implementation {
    /**
     * Initializing Ethereum blockchain connector
     */
    constructor({ config, emitter, logger }, configuration) {
        super({
            config,
            emitter,
            logger,
            contractPath: path.join(__dirname, 'abi'),
        }, configuration);

        this.logger.info(`[${this.getBlockchainId()}] Selected blockchain: Ethereum`);
    }

    static async getRelativeTracPrice() {
        const response = await axios.get(coinGeckoLink);
        if (response) {
            return response.data.origintrail.eth;
        }
        return undefined;
    }

    /**
     * Returns gas price, throws error if not urgent and gas price higher than maximum allowed price
     * @param urgent
     * @returns {Promise<*|number>}
     */
    async getGasPrice(urgent = false) {
        const gasPrice = await this.calculateGasPrice();
        if (gasPrice > this.config.max_allowed_gas_price && !urgent) {
            throw new Error(`[${this.getBlockchainId()}] Gas price higher than maximum allowed price`);
        } else {
            return gasPrice;
        }
    }

    async calculateGasPrice() {
        if (process.env.NODE_ENV !== 'mainnet') {
            this.logger.trace(`[${this.getBlockchainId()}] Using default gas price from `
                + `configuration: ${this.config.gas_price}`);

            return this.config.gas_price;
        }

        const now = new Date().getTime();
        if (this.config.gas_price_last_update_timestamp
            + constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS > now) {
            this.logger.trace(`[${this.getBlockchainId()}] Using gas price from configuration: `
                + `${this.config.gas_price}`);

            return this.config.gas_price;
        }
        let gasStationGasPrice = await this.getGasStationGasPrice()
            .catch((err) => { this.logger.warn(err); }) * constants.AVERAGE_GAS_PRICE_MULTIPLIER;
        gasStationGasPrice = Math.round(gasStationGasPrice);

        let web3GasPrice = await this.web3.eth.getGasPrice()
            .catch((err) => { this.logger.warn(err); }) * constants.AVERAGE_GAS_PRICE_MULTIPLIER;
        web3GasPrice = Math.round(web3GasPrice);
        if (gasStationGasPrice && web3GasPrice) {
            const gasPrice = (
                gasStationGasPrice > web3GasPrice ? gasStationGasPrice : web3GasPrice);
            this.saveNewGasPriceAndTime(gasPrice);
            const service = gasStationGasPrice > web3GasPrice ? 'gas station' : 'web3';
            this.logger.trace(`[${this.getBlockchainId()}] Using gas price from ${service}`
                + ` service: ${gasStationGasPrice}`);

            return gasPrice;
        } else if (gasStationGasPrice) {
            this.saveNewGasPriceAndTime(gasStationGasPrice);
            this.logger.trace(`[${this.getBlockchainId()}] Using gas price from gas station`
                + ` service: ${gasStationGasPrice}`);

            return gasStationGasPrice;
        } else if (web3GasPrice) {
            this.saveNewGasPriceAndTime(web3GasPrice);
            this.logger.trace(`[${this.getBlockchainId()}] Using gas price from web3`
                + ` service: ${web3GasPrice}`);

            return web3GasPrice;
        }
        this.logger.trace(`[${this.getBlockchainId()}] Using gas price from configuration: `
            + `${this.config.gas_price}`);

        return this.config.gas_price;
    }

    async getGasStationGasPrice() {
        const response = await axios.get(gasStationLink)
            .catch((err) => {
                this.logger.warn(err);
                return undefined;
            });
        if (response) {
            return response.data.average * 100000000;
        }
        return undefined;
    }

    saveNewGasPriceAndTime(gasPrice) {
        this.config.gas_price = gasPrice;
        this.config.gas_price_last_update_timestamp = new Date().getTime();
    }
}

module.exports = Ethereum;
