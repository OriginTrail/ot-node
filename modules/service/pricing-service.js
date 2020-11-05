const constants = require('../constants');
const BN = require('bn.js');

const minutesInDay = 60 * 24;

class PricingService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.gasStationService = ctx.gasStationService;
        this.web3 = ctx.web3;
        this.tracPriceService = ctx.tracPriceService;
    }

    async calculateOfferPriceinTrac(dataSizeInBytes, holdingTimeInMinutes, priceFactor) {
        if (!dataSizeInBytes) {
            throw new Error('Calculate offer price method called. Data size in bytes not defined!');
        }
        if (!holdingTimeInMinutes) {
            throw new Error('Calculate offer price method called. Holding time in minutes not defined!');
        }

        const {
            basePayoutCostInTrac,
            tracInEth,
            gasPriceInGwei,
        } = await this._calculateBasePayoutInTrac();

        const holdingTimeInDays = holdingTimeInMinutes / minutesInDay;
        const dataSizeInMB = dataSizeInBytes / 1000000;

        const price = (2 * basePayoutCostInTrac) + (priceFactor *
        Math.sqrt(2 * holdingTimeInDays * dataSizeInMB));

        const finalPrice = price * 1000000000000000000;
        this.logger.trace(`Calculated offer price for data size: ${dataSizeInMB}MB, and holding time: ${holdingTimeInDays} days, PRICE: ${finalPrice}[mTRAC]`);
        return { finalPrice, tracInEth, gasPriceInGwei };
    }

    async _calculateBasePayoutInTrac() {
        const tracInEth = await this.tracPriceService.getTracPriceInEth();

        const gasPriceInGwei = await this.getGasPrice() / 1000000000;
        const basePayoutInEth = (constants.BASE_PAYOUT_GAS * gasPriceInGwei) / 1000000000;
        const basePayoutCostInTrac = basePayoutInEth / tracInEth;
        return { basePayoutCostInTrac, tracInEth, gasPriceInGwei };
    }

    async getGasPrice() {
        if (process.env.NODE_ENV !== 'mainnet') {
            this.logger.trace(`Using default gas price from configuration: ${this.config.blockchain.gas_price}`);
            return this.config.blockchain.gas_price;
        }

        const now = new Date().getTime();
        if (this.config.blockchain.gas_price_last_update_timestamp
            + constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS > now) {
            this.logger.trace(`Using gas price from configuration: ${this.config.blockchain.gas_price}`);
            return this.config.blockchain.gas_price;
        }
        let gasStationGasPrice = await this.gasStationService.getGasPrice()
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
            this.logger.trace(`Using gas price from ${service} service: ${gasStationGasPrice}`);
            return gasPrice;
        } else if (gasStationGasPrice) {
            this.saveNewGasPriceAndTime(gasStationGasPrice);
            this.logger.trace(`Using gas price from gas station service: ${gasStationGasPrice}`);
            return gasStationGasPrice;
        } else if (web3GasPrice) {
            this.saveNewGasPriceAndTime(web3GasPrice);
            this.logger.trace(`Using gas price from web3 service: ${web3GasPrice}`);
            return web3GasPrice;
        }
        this.logger.trace(`Using gas price from configuration: ${this.config.blockchain.gas_price}`);
        return this.config.blockchain.gas_price;
    }

    saveNewGasPriceAndTime(gasPrice) {
        this.config.blockchain.gas_price = gasPrice;
        this.config.blockchain.gas_price_last_update_timestamp = new Date().getTime();
    }
}

module.exports = PricingService;
