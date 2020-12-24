const request = require('request');

class OtNodeClient {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
    }

    async getNodeData(remoteHostname, body, useSsl = true) {
        this.protocol = useSsl ? 'https' : 'http';
        this.baseUrl = `${this.protocol}://${remoteHostname}:8900/api/latest`;
        return new Promise((accept, reject) => {
            request({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                url: `${this.baseUrl}/node_data`,
                body,
                json: true,
            }, (error, response, body) => {
                if (error) {
                    reject(error);
                    return;
                }
                accept(body);
            });
        });
    }

    async healthCheck(remoteHostname, timeout = 60000, useSsl = true) {
        this.protocol = useSsl ? 'https' : 'http';
        this.baseUrl = `${this.protocol}://${remoteHostname}:8900/api/latest`;
        return new Promise((accept, reject) => {
            request({
                timeout,
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                url: `${this.baseUrl}/health_check`,
            }, (error, response, body) => {
                if (error) {
                    reject(error);
                    return;
                }
                accept(response);
            });
        });
    }
}

module.exports = OtNodeClient;
