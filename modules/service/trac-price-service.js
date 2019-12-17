const axios = require('axios');
const constants = require('../constants');

const coinGeckoLink = 'https://api.coingecko.com/api/v3/simple/price?ids=origintrail&vs_currencies=eth';

class TracPriceService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    async getTracPriceInEth() {
        if (process.env.NODE_ENV === 'development') {
            return this.config.blockchain.trac_price_in_eth;
        }

        const now = new Date().getTime();
        if (this.config.blockchain.trac_price_in_eth_last_update_timestamp
            + constants.TRAC_PRICE_IN_ETH_VALIDITY_TIME_IN_MILLS > now) {
            return this.config.blockchain.trac_price_in_eth;
        }
        let tracPriceInEth;
        const response = await axios.get(coinGeckoLink)
            .catch((err) => {
                this.logger.warn(err);
            });
        if (response) {
            tracPriceInEth = response.data.origintrail.eth;
        }
        if (tracPriceInEth) {
            this._saveNewTracPriceInEth(tracPriceInEth);
            return tracPriceInEth;
        }
        return this.config.blockchain.trac_price_in_eth;
    }

    _saveNewTracPriceInEth(tracePrice) {
        this.config.blockchain.trac_price_in_eth = tracePrice;
        this.config.blockchain.trac_price_in_eth_last_update_timestamp = new Date().getTime();
    }
}

module.exports = TracPriceService;
