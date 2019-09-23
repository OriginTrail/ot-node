const constants = require('../constants');

class GasPriceService {
    construction(ctx) {
        this.config = ctx.config;
        this.axiosService = ctx.axiosService;
        this.web3 = ctx.web3;
    }

    async getGasPrice() {
        // if !mainnet send default
        const now = new Date().getTime();
        if (this.config.gas_price_last_update_time_in_miliseconds + constants.GAS_PRICE_VALIDITY_TIME > now) {
            return this.config.gas_price;
        }
        const axiosResponse = await this.axiosService.getGasPrice()
            .catch((err) => { this.log.warn(err); });




        return axiosResponse.data.average * 100000000;
    }

}

module.exports = GasPriceService;
