const constants = require('../constants');
const Web3 = require('web3');

class GasPriceService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.axiosService = ctx.axiosService;
    }

    async getGasPrice() {
        if (process.env.NODE_ENV !== 'mariner') {
            return this.config.blockchain.gas_price;
        }

        const now = new Date().getTime();
        if (this.config.gas_price_last_update_time_in_miliseconds
            + constants.GAS_PRICE_VALIDITY_TIME > now) {
            return this.config.gas_price;
        }
        const axiosResponse = await this.axiosService.getGasPrice()
            .catch((err) => { this.logger.warn(err); });

        const web3 =
            new Web3(new Web3.providers.HttpProvider(this.config.blockchain.rpc_server_url));

        const web3GasPrice = await web3.eth.getGasPrice()
            .catch((err) => { this.logger.warn(err); });

        if (axiosResponse && web3GasPrice) {
            const axiosGasPrice = axiosResponse.data.average * 100000000;
            const gasPrice = (axiosGasPrice > web3GasPrice ? axiosResponse : web3GasPrice);
            this.saveNewGasPriceAndTime(gasPrice);
            return gasPrice;
        } else if (axiosResponse) {
            const axiosGasPrice = axiosResponse.data.average * 100000000;
            this.saveNewGasPriceAndTime(axiosGasPrice);
            return axiosGasPrice;
        } else if (web3GasPrice) {
            this.saveNewGasPriceAndTime(web3GasPrice);
            return web3GasPrice;
        }
        return this.config.blockchain.gas_price;
    }

    saveNewGasPriceAndTime(gasPrice) {
        this.config.blockchain.gas_price = gasPrice * constants.AVERAGE_GAS_PRICE_MULTIPLIER;
        this.config.blockchain.gas_price_last_update_time_in_miliseconds = new Date().getTime();
    }
}

module.exports = GasPriceService;
