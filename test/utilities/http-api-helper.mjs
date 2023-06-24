import axios from 'axios';

class HttpApiHelper {
    async info(nodeRpcUrl) {
        return this._sendRequest('get', `${nodeRpcUrl}/info`);
    }

    async get(nodeRpcUrl, requestBody) {
        return this._sendRequest('post', `${nodeRpcUrl}/get`, requestBody);
    }

    async getOperationResult(nodeRpcUrl, operationName, operationId) {
        return this._sendRequest('get', `${nodeRpcUrl}/${operationName}/${operationId}`);
    }

    async publish(nodeRpcUrl, requestBody) {
        return this._sendRequest('post', `${nodeRpcUrl}/publish`, requestBody);
    }

    async update(nodeRpcUrl, requestBody) {
        return this._sendRequest('post', `${nodeRpcUrl}/update`, requestBody);
    }

    async _sendRequest(method, url, data) {
        return axios({
            method,
            url,
            ...data && { data },
        }).catch((error) => {
            const errorWithStatus = new Error(error.message);
            if (error.response) {
                errorWithStatus.statusCode = error.response.status;
            }
            throw errorWithStatus;
        });
    }
}
export default HttpApiHelper;
