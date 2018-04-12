const graph = require('./Graph');
const Challenge = require('./Challenge');
const utilities = require('./Utilities');
const config = require('./Config');
const Blockchain = require('./BlockChainInstance');
const MessageHandler = require('./MessageHandler');
const Storage = require('./Storage');
const deasync = require('deasync-promise');
const challenger = require('./Challenger');

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

            const currentUnixTime = Math.floor(new Date() / 1000);
            const min10 = currentUnixTime + 120 + 60; // End of testing period
            const options = {
                dh_wallet: '0x1a2C6214dD5A52f73Cb5C8F82ba513DA1a0C8fcE',
                import_id: data.data_id,
                amount: data.vertices.length + data.edges.length,
                start_time: currentUnixTime + 120,
                total_time: 10 * 60,
            };
            /*
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
*/
            const tests = Challenge.generateTests(
                config.identity, options.import_id, 10,
                options.start_time, options.start_time + 120, 10, data.encryptedVertices.vertices,
            );

            Challenge.addTests(tests).then(() => {
                challenger.startChallenging();
            }, () => {
                log.error(`Failed to generate challenges for ${config.identity}, import ID ${options.import_id}`);
            });

            const payload = JSON.stringify({
                payload: {
                    vertices: data.encryptedVertices.vertices,
                    public_key: data.encryptedVertices.public_key,
                    edges: data.edges,
                    data_id: data.data_id,
                    dc_wallet: config.blockchain.wallet_address,
                },
            });

            // send payload to DH
            MessageHandler.sendDirectMessage('7780bc74f3c0c95fd2c2bf2d7db889d38619eb60', 'payload-request', payload)
                .then(() => {
                    // save holding data config.DH_WALLET, data.data_id, payload.public_key
                    // Storage.models.holding_data.create({
                    //     dc_id: config.identity,
                    //     data_id: options.data_id,
                    //     start_time: options.start_time,
                    //     end_time: options.start_time + 120,
                    //     total_token: options.amount,
                    // });
                });
        });
    }
}

module.exports = DataReplication;
