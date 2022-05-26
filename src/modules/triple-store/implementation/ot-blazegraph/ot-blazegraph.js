const axios = require('axios');
const OtTripleStore = require('../ot-triple-store');

class OtBlazegraph extends OtTripleStore {
    async healthCheck() {
        try {
            const response = await axios.get(`${this.config.url}/status`, {});
            if (response.data !== null) {
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    getName() {
        return 'OtBlazegraph';
    }
}

module.exports = OtBlazegraph;
