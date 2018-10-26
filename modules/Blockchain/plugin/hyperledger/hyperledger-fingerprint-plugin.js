const request = require('request');
const AbstractPlugin = require('../abstract-plugin');

/**
 * Does fingerprinting on Hyperledger
 */
class HyperledgerFingerprintPlugin extends AbstractPlugin {
    constructor(ctx) {
        super();
        this.logger = ctx.logger;
    }

    /**
     * Initialize plugin
     * @param config
     */
    initialize(config) {
        this.config = config;
    }

    /**
     * Executes plugin code
     * @param data - Plugin data
     * @return {Promise<void>}
     */
    execute(data) {
        return new Promise((resolve, reject) => {
            const { dataSetId, dataRootHash } = data;
            const { user, pass } = this.config.auth;

            const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
            const options = {
                uri: this.config.url,
                method: 'POST',
                headers: { Authorization: auth },
                json: {
                    channel: 'default',
                    chaincode: 'TraceFingerprint',
                    method: 'set',
                    chaincodeVer: 'v1',
                    args: [dataSetId, dataRootHash],
                    proposalWaitTime: 50000,
                    transactionWaitTime: 60000,
                },
            };
            request(options, (error, response, body) => {
                if (error) {
                    this.logger.warn(`Failed to write fingerprint for data set ${dataSetId} to Hyperledger.`);
                    reject(error);
                } else {
                    const { statusCode } = response;
                    if (statusCode === 200) {
                        this.logger.notify(`Fingerprint for data set ${dataSetId} written to Hyperledger.`);
                        resolve({
                            payload: body.result.payload,
                            tx_id: body.txid,
                        });
                    }
                }
            });
        });
    }
}

module.exports = HyperledgerFingerprintPlugin;
