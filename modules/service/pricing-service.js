const constants = require('../constants');
const BN = require('bn.js');

class PricingService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.gasStationService = ctx.gasStationService;
        this.web3 = ctx.web3;
    }

    calculateOfferPrice(holdingTimeInMinutes, dataSizeInBytes) {
        // 2*base_payout_trac+PriceFactor*SQRT(2*filesize*jobDuration)

        if (!holdingTimeInMinutes) {
            holdingTimeInMinutes = new BN(this.config.dc_holding_time_in_minutes, 10);
        }

        // TODO calculate base payout using some oracle
        const basePayoutTrac = 18;

        const holdingTimeInDays = holdingTimeInMinutes.div(new BN(1440));
        const dataSizeInMb = dataSizeInBytes / 1000000;

        // TODO get price facotr from configuration
        const priceFactor = 2;

        // const price = (2 * basePayoutTrac) + (priceFactor *
        // Math.sqrt(2 * holdingTimeInDays * dataSizeInMb));
        //
        // return price;
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
        const gasStationGasPrice = await this.gasStationService.getGasPrice()
            .catch((err) => { this.logger.warn(err); }) * constants.AVERAGE_GAS_PRICE_MULTIPLIER;

        const web3GasPrice = await this.web3.eth.getGasPrice()
            .catch((err) => { this.logger.warn(err); }) * constants.AVERAGE_GAS_PRICE_MULTIPLIER;

        if (gasStationGasPrice && web3GasPrice) {
            const gasPrice = (
                gasStationGasPrice > web3GasPrice ? gasStationGasPrice : web3GasPrice);
            this.saveNewGasPriceAndTime(gasPrice);
            return gasPrice;
        } else if (gasStationGasPrice) {
            this.saveNewGasPriceAndTime(gasStationGasPrice);
            return gasStationGasPrice;
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

module.exports = PricingService;
