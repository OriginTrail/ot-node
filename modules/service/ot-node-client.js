const request = require('request');

class OtNodeClient {
    constructor(ctx) {
        this.logger = ctx.logger;
    }

    async getNodeData(remoteHostname, request) {
        this.baseUrl = `http://${remoteHostname}:8900/api/latest`;
        return new Promise((accept, reject) => {
            request({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                url: `${this.baseUrl}/node_data`,
                json: true,
                body: request,
            }, (error, response, body) => {
                if (error) {
                    reject(error);
                    return;
                }
                accept(body);
            });
        });
    }
}

module.exports = OtNodeClient;
