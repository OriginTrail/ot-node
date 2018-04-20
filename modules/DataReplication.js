const graph = require('./Graph');
const Challenge = require('./Challenge');
const utilities = require('./Utilities');
const config = require('./Config');
const Blockchain = require('./BlockChainInstance');
const Storage = require('./Storage');
const deasync = require('deasync-promise');
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
    static sendPayload(data) {
        return new Promise((resolve, reject) => {
            log.info('Entering sendPayload');

            const currentUnixTime = Date.now();
            const min10 = currentUnixTime + 120 + 60; // End of testing period
            const options = {
                dh_wallet: config.dh_wallet,
                import_id: data.data_id,
                amount: data.amout,
                start_time: currentUnixTime,
                total_time: 10 * 60000,
            };

            try {
                deasync(Blockchain.bc.increaseApproval(options.amount));
                deasync(Blockchain.bc.initiateEscrow(
                    options.dh_wallet,
                    options.import_id,
                    options.amount,
                    options.total_time,
                ));
            } catch (e) {
                console.log(e);
            }

            data.encryptedVertices.vertices.sort((a, b) => {
                if (a._key < b._key) { return -1; } else if (a._key > b._key) { return 1; }
                return 0;
            });

            const tests = Challenge.generateTests(
                config.dh[0], options.import_id.toString(), 10,
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
                    vertices: data.encryptedVertices.vertices,
                    public_key: data.encryptedVertices.public_key,
                    edges: data.edges,
                    data_id: data.data_id,
                    dc_wallet: config.blockchain.wallet_address,
                },
            };

            // send payload to DH
            node.ot.payloadRequest(payload, node.ot.getNearestNeighbour(), () => {
                log.info('Payload request sent');
            });
        });
    }
}

module.exports = DataReplication;
