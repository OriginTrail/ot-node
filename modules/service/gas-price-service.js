const constants = require('../constants');
const Web3 = require('web3');

class GasPriceService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.axiosService = ctx.axiosService;
        this.web3 = ctx.web3;
    }

    async getGasPrice() {
        if (process.env.NODE_ENV !== 'mariner' && process.env.NODE_ENV !== 'production') {
            return this.config.blockchain.gas_price;
        }

        const now = new Date().getTime();
        if (this.config.blockchain.gas_price_last_update_timestamp
            + constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS > now) {
            return this.config.blockchain.gas_price;
        }
        const axiosGasPrice = await this.axiosService.getGasPrice()
            .catch((err) => { this.logger.warn(err); }) * constants.AVERAGE_GAS_PRICE_MULTIPLIER;

        const web3GasPrice = await this.web3.eth.getGasPrice()
            .catch((err) => { this.logger.warn(err); }) * constants.AVERAGE_GAS_PRICE_MULTIPLIER;

        if (axiosGasPrice && web3GasPrice) {
            const gasPrice = (axiosGasPrice > web3GasPrice ? axiosGasPrice : web3GasPrice);
            this.saveNewGasPriceAndTime(gasPrice);
            return gasPrice;
        } else if (axiosGasPrice) {
            this.saveNewGasPriceAndTime(axiosGasPrice);
            return axiosGasPrice;
        } else if (web3GasPrice) {
            this.saveNewGasPriceAndTime(web3GasPrice);
            return web3GasPrice;
        }
        return this.config.blockchain.gas_price;
    }

    saveNewGasPriceAndTime(gasPrice) {
        this.config.blockchain.gas_price = gasPrice;
        this.config.blockchain.gas_price_last_update_timestamp = new Date().getTime();
    }
}

module.exports = GasPriceService;
