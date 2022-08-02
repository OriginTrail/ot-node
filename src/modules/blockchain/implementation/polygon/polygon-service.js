const Web3Service = require('../web3-service');
const axios = require('axios');

const GAS_STATION_LINK = 'https://gasstation-mumbai.matic.today/v2';

class PolygonService extends Web3Service {
    async getGasPrice() {
        try {
            const response = await axios.get(GAS_STATION_LINK);
            const gasPriceRounded = Math.round(response.data.standard.maxFee * 1e9);
            return gasPriceRounded;
        } catch (e) {
            this.logger.warn(err);
            return undefined;
        }
    }
}

module.exports = PolygonService;
