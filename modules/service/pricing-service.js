const constants = require('../constants');
const BN = require('bn.js');

const minutesInDay = 60 * 24;

class PricingService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.gasStationService = ctx.gasStationService;
        this.web3 = ctx.web3;
        this.blockchain = ctx.blockchain;
    }

    async calculateOfferPriceinTrac(
        dataSizeInBytes,
        holdingTimeInMinutes,
        priceFactor,
        blockchain_id,
    ) {
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
        } = await this._calculateBasePayoutInTrac(blockchain_id);

        const holdingTimeInDays = holdingTimeInMinutes / minutesInDay;
        const dataSizeInMB = dataSizeInBytes / 1000000;

        const price = (2 * basePayoutCostInTrac) + (priceFactor *
        Math.sqrt(2 * holdingTimeInDays * dataSizeInMB));

        const finalPrice = price * 1000000000000000000;
        this.logger.trace(`Calculated offer price for data size: ${dataSizeInMB}MB, and holding time: ${holdingTimeInDays} days, PRICE: ${finalPrice}[mTRAC]`);
        return { finalPrice, tracInEth, gasPriceInGwei };
    }

    async _calculateBasePayoutInTrac(blockchain_id) {
        const tracInEth = await this.blockchain.getTracPrice(blockchain_id);

        const gasPriceInGwei = await this.blockchain.getGasPrice(blockchain_id) / 1000000000;
        const basePayoutInEth = (constants.BASE_PAYOUT_GAS * gasPriceInGwei) / 1000000000;
        const basePayoutCostInTrac = basePayoutInEth / tracInEth;
        return { basePayoutCostInTrac, tracInEth, gasPriceInGwei };
    }
}

module.exports = PricingService;
