const request = require('request');
const axios = require('axios');

class HttpApiHelper {
    info(nodeRpcUrl) {
        return new Promise((accept, reject) => {
            request(`${nodeRpcUrl}/info`, { json: true }, (err, res, body) => {
                if (err) {
                    reject(err);
                    return;
                }
                accept(body);
            });
        });
    }

    get(nodeRpcUrl, ual) {
        // Not sure if header is needed
        return axios({
            method: 'post',
            url: `${nodeRpcUrl}/get`,
            data: ual,
            headers: {
                'Content-Type': 'application/json',
            },
        })
            .then((response) => response)
            .catch((e) => {
                throw Error(`Unable to GET: ${e.message}`);
            });
    }

    getOperationResult(nodeRpcUrl, operationId) {
        return axios({
            method: 'get',
            url: `${nodeRpcUrl}/publish/${operationId}`,
        })
            .then((response) => response)
            .catch((e) => {
                throw Error(`Unable to PUBLISH: ${e.message}`);
            });
    }

    publish(nodeRpcUrl, requestBody) {
        return axios({
            method: 'post',
            url: `${nodeRpcUrl}/publish`,
            data: requestBody,
        })
            .then((response) => response)
            .catch((e) => {
                throw Error(`Unable to publish: ${e.message}`);
            });
    }
}

module.exports = HttpApiHelper;
