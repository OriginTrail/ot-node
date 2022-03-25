const request = require('request');

class HttpApiHelper {
    info(nodeRpcUrl) {
        return new Promise((accept, reject) => {
            request(
                `${nodeRpcUrl}/info`,
                { json: true },
                (err, res, body) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    accept(body);
                },
            );
        });
    }
}

module.exports = HttpApiHelper;
