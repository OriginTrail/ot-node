import axios from 'axios';

class HttpApiHelper {
    async info(nodeRpcUrl) {
        return axios({
            method: 'get',
            url: `${nodeRpcUrl}/info`,
        }).catch((e) => {
            throw Error(`Unable to get info: ${e.message}`);
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

    async publish(nodeRpcUrl, requestBody) {
        return axios({
            method: 'post',
            url: `${nodeRpcUrl}/publish`,
            data: requestBody,
        }).catch((e) => {
            throw Error(`Unable to publish: ${e.message}`);
        });
    }
}

export default HttpApiHelper;
