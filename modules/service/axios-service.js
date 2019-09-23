const axios = require('axios');

class AxiosService {
    async getGasPrice() {
        return axios.get('https://ethgasstation.info/json/ethgasAPI.json');
    }
}

module.exports = AxiosService;
