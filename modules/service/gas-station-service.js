const axios = require('axios');

class GasStationService {
    async getGasPrice() {
        const response = await axios.get('https://ethgasstation.info/json/ethgasAPI.json')
            .catch((err) => {
                this.log.warn(err);
                return undefined;
            });
        if (response) {
            return response.data.average * 100000000;
        }
        return undefined;
    }
}

module.exports = GasStationService;