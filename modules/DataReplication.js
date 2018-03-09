const axios = require('axios');
const graph = require('./graph')();
const testing = require('./testing')();
const utilities = require('./utilities')();
const log = utilities.getLogger();
const config = utilities.getConfig();

class DataReplication {

	/**
	* Sends data to DH for replication
	*
	* @param data object {VERTICES, EDGES, IMPORT_ID} This is the payload to be sent
	* @return object response
	*/

	async sendPayload(data) {

		log.info('Entering sendPayload');
		let encryptedVertices = graph.encryptVertices(data.vertices);

		let currentUnixTime = Math.floor(new Date() / 1000);
		let min10 = currentUnixTime + (10 * 60); // for hum much time do we want testing

		testing.generateTests(config.NODE_IP, config.RPC_API_PORT, config.blockchain.settings.ethereum.wallet_address, encryptedVertices.vertices, 10, currentUnixTime, min10, (res, err) => {
			log.info('[DC] Tests generated');

			const test_table = require('./test_table')();
			test_table.getTests((res) => {
				log.info('tests');
				log.info(res);

			});
		});

		const payload = JSON.stringify({
			vertices: encryptedVertices.vertices,
			public_key: encryptedVertices.public_key,
			edges: data.edges,
			import_id: data.import_id
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
			let result = await axios(options);
			log.info('Payload sent');
			return result.data;
		} catch(e) {
			log.error('Payload not sent');
			console.log(e);
		}

	}

}

module.exports = new DataReplication;