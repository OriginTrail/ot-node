const axios = require('axios');
const constants = require('../constants');

const coinGeckoLink = 'https://api.coingecko.com/api/v3/simple/price?ids=origintrail&vs_currencies=eth';

class TracPriceService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }


    async getTracPrice() {
        const response = await axios.get(coinGeckoLink)
            .catch((err) => {
                this.logger.warn(err);
                return undefined;
            });
        if (response) {
            return response.data.average * 100000000;
        }
        return undefined;
    }
}

module.exports = TracPriceService;
