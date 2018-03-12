const axios = require('axios');
const graph = require('./graph')();
const testing = require('./testing')();
const holding = require('./holding')();
const utilities = require('./utilities')();
const signing = require('./blockchain_interface/ethereum/signing')();
const log = utilities.getLogger();
const config = utilities.getConfig();


class DataReplication {

	/**
	* Sends data to DH for replication
	*
	* @param data object {VERTICES, EDGES, IMPORT_ID} This is the payload to be sent
	* @return object response
	*/
	sendPayload(data, callback) {
		log.info('Entering sendPayload');

		var currentUnixTime = Math.floor(new Date() / 1000);
		var min10 = currentUnixTime + 120 + 60; // End of testing period
		let options_signing = {
			dh_wallet: config.DH_WALLET,
			import_id: data.data_id,
			amount: data.vertices.length + data.edges.length,
			start_time: currentUnixTime + 120,
			total_time: 60
		};
		signing.signAndAllow(options_signing).then(response => {
			log.warn('Sign and Allow Response:');
			log.warn(response);
			graph.encryptVertices(config.DH_NODE_IP, config.DH_NODE_PORT, data.vertices, encryptedVertices => {
				

				testing.generateTests(data.data_id, config.DH_NODE_IP, config.DH_NODE_PORT, config.blockchain.settings.ethereum.wallet_address, encryptedVertices.vertices, 10, currentUnixTime + 120, min10, (res, err) => {
					log.info('[DC] Tests generated');
				});
				const payload = JSON.stringify({
					vertices: encryptedVertices.vertices,
					public_key: encryptedVertices.public_key,
					edges: data.edges,
					data_id: data.data_id,
					dc_wallet: config.blockchain.settings.ethereum.wallet_address
				});
				const options = {
					method: 'POST',
					url: 'http://' + config.DH_NODE_IP + ':' + config.DH_NODE_PORT + '/api/replication',
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': payload.length
					},
					data: payload
				};
				try {
					axios(options).then(result => {
						log.info('Payload sent');
						holding.addHoldingData(config.DH_WALLET, data.data_id, payload.public_key, () => {
							log.info('[DH] Holding data saved into database');
						});
						utilities.executeCallback(callback, result.data);
					}).catch(err => {
						console.error(err);
					});

				} catch(e) {
					log.error('Payload not sent');
					console.error('DH connection failed');
				}
			});
		});

	}	

}

module.exports = new DataReplication;