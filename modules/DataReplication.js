const Challenge = require('./Challenge');
const config = require('./Config');
const challenger = require('./Challenger');
const node = require('./Node');

const log = require('./Utilities').getLogger();

class DataReplication {
    /**
     * Sends data to DH for replication
     *
     * @param data object {VERTICES, EDGES, IMPORT_ID} This is the payload to be sent
     * @return object response
     */
    async sendPayload(data) {
        log.info('Entering sendPayload');

        const currentUnixTime = Date.now();
        const options = {
            offer_hash: data.offer_hash,
            dh_wallet: config.dh_wallet,
            import_id: data.import_id,
            amount: data.vertices.length + data.edges.length,
            start_time: currentUnixTime,
            total_time: 10 * 60000,
        };

        data = this._sortEncryptedVertices(data);

        const tests = Challenge.generateTests(
            data.contact, options.import_id.toString(), 10,
            options.start_time, options.start_time + options.total_time,
            16, data.encryptedVertices.vertices,
        );

        Challenge.addTests(tests).then(() => {
            challenger.startChallenging();
        }, () => {
            log.error(`Failed to generate challenges for ${config.identity}, import ID ${options.import_id}`);
        });

        const payload = {
            payload: {
                offer_hash: data.offer_hash,
                edges: data.edges,
                import_id: data.import_id,
                dc_wallet: config.blockchain.wallet_address,
                public_key: data.encryptedVertices.public_key,
                vertices: data.encryptedVertices.vertices,
            },
        };

        // send payload to DH
        node.ot.payloadRequest(payload, data.contact, () => {
            log.info('Payload request sent');
        });
    }

    /**
     * Sort encypted vertices according to their keys
     * @param data
     * @return {*}
     * @private
     */
    _sortEncryptedVertices(data) {
        data.encryptedVertices.vertices.sort((a, b) => {
            if (a._key < b._key) {
                return -1;
            } else if (a._key > b._key) {
                return 1;
            }
            return 0;
        });
        return data;
    }
}

module.exports = DataReplication;
