import axios from 'axios';

class HttpApiHelper {
    async info(nodeRpcUrl) {
        try {
            const response = await axios({
                method: 'get',
                url: `${nodeRpcUrl}/info`,
            });

            return response;
        } catch (e) {
            throw Error(`Unable to get info: ${e.message}`);
        }
    }

    async get(nodeRpcUrl, ual) {
        // Not sure if header is needed
        try {
            const response = await axios({
                method: 'post',
                url: `${nodeRpcUrl}/get`,
                data: ual,
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            return response;
        } catch (e) {
            throw Error(`Unable to GET: ${e.message}`);
        }
    }

    async getOperationResult(nodeRpcUrl, operationId) {
        try {
            const response = await axios({
                method: 'get',
                url: `${nodeRpcUrl}/publish/${operationId}`,
            });

            return response;
        } catch (e) {
            throw Error(`Unable to PUBLISH: ${e.message}`);
        }
    }

    async publish(nodeRpcUrl, requestBody) {
        try {
            const response = await axios({
                method: 'post',
                url: `${nodeRpcUrl}/publish`,
                data: requestBody,
            });

            return response;
        } catch (e) {
            throw Error(`Unable to publish: ${e.message}`);
        }
    }
}
export default HttpApiHelper;
