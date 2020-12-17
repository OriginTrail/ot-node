const axios = require('axios');
const constants = require('../constants');

const coinGeckoLink = 'https://api.coingecko.com/api/v3/simple/price?ids=origintrail&vs_currencies=eth';

class TracPriceService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    async getTracPriceInEth() {
        if (process.env.NODE_ENV !== 'mainnet') {
            this.logger.trace(`Using default trac price in eth from configuration: ${this.config.blockchain.trac_price_in_eth}`);
            return this.config.blockchain.trac_price_in_eth;
        }

        const now = new Date().getTime();
        if (this.config.blockchain.trac_price_in_eth_last_update_timestamp
            + constants.TRAC_PRICE_IN_ETH_VALIDITY_TIME_IN_MILLS > now) {
            this.logger.trace(`Using trac price in eth from configuration: ${this.config.blockchain.trac_price_in_eth}`);
            return this.config.blockchain.trac_price_in_eth;
        }
        let tracPriceInEth = this.config.blockchain.trac_price_in_eth;
        const response = await axios.get(coinGeckoLink)
            .catch((err) => {
                this.logger.warn(err);
            });
        if (response) {
            tracPriceInEth = response.data.origintrail.eth;
        }
        if (tracPriceInEth) {
            this._saveNewTracPriceInEth(tracPriceInEth);
            this.logger.trace(`Using trac price in eth from coingecko service: ${tracPriceInEth}`);
        } else {
            tracPriceInEth = this.config.blockchain.trac_price_in_eth;
            this.logger.trace(`Using trac price in eth from configuration: ${tracPriceInEth}`);
        }
        return tracPriceInEth;
    }

    _saveNewTracPriceInEth(tracePrice) {
        this.config.blockchain.trac_price_in_eth = tracePrice;
        this.config.blockchain.trac_price_in_eth_last_update_timestamp = new Date().getTime();
    }
}

module.exports = TracPriceService;
