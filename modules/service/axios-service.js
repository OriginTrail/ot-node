const axios = require('axios');

class AxiosService {
    async getGasPrice() {
        return axios.get('https://ethgasstation.info/json/ethgasAPI.json')
            .catch((err) => {
                this.log.warn(err);
                return undefined;
            });
    }
}

module.exports = AxiosService;
