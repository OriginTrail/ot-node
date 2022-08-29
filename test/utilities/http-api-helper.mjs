import request from 'request';
import axios from 'axios';

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

    getOperationResult(nodeRpcUrl, operationId) {
        return axios({
            method: 'get',
            url: `${nodeRpcUrl}/publish/${operationId}`,
        })
            .then((response) => response)
            .catch((e) => {
                throw Error(`Unable to publish: ${e.message}`);
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

    // PUBLISH REQUEST BODY
    /* {
      "publishType": "asset",
      "assertionId": "0xc311cca6412f8453067ac7a04831af411b2963734d107541763c1ef7c8e56f65",
      "assertion": [
        "_:c14n0 <http://schema.org/born> \"Born: April 30, 1916, Petoskey, Michigan, United States\" .",
        "_:c14n0 <http://schema.org/description> \"Claude Elwood Shannon was an American mathematician, electrical engineer, and cryptographer known as the father of information theory. \" .",
        "_:c14n0 <http://schema.org/died> \"Died: February 24, 2001, Medford, Massachusetts, United States\" .",
        "_:c14n0 <http://schema.org/name> \"Claude Shànnon\" .",
        "_:c14n0 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> ."
      ],
      "blockchain": "ganache",
      "contract": "0x378ec78f621e2c8aeff345b39334c38b0bb7b96f",
      "tokenId": 0
    } */
}

export default HttpApiHelper;
