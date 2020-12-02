const axios = require('axios');

class OtNodeClient {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    async getNodeData(remoteHostname, request) {
        this.baseUrl = `http://${remoteHostname}:8900/api/latest`;
        const response = await axios.post(
            `${this.baseUrl}/node_data`,
            request,
        )
            .catch((err) => {
                this.logger.error('Failed to fetch node data: ', err);
                throw err;
            });
        return response.data;
    }
}

module.exports = OtNodeClient;
