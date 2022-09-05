import axios from 'axios';

export async function info(nodeRpcUrl) {
    return axios({
        method: 'get',
        url: `${nodeRpcUrl}/info`,
    }).catch((e) => {
        throw Error(`Unable to get info: ${e.message}`);
    });
};

export function get(nodeRpcUrl, ual) {
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

export function getOperationResult(nodeRpcUrl, operationId) {
    return axios({
        method: 'get',
        url: `${nodeRpcUrl}/publish/${operationId}`,
    })
        .then((response) => response)
        .catch((e) => {
            throw Error(`Unable to PUBLISH: ${e.message}`);
        });
}

export async function publish(nodeRpcUrl, requestBody) {
    return axios({
        method: 'post',
        url: `${nodeRpcUrl}/publish`,
        data: requestBody,
    }).catch((e) => {
        throw Error(`Unable to publish: ${e.message}`);
    });
}
