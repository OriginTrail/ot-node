const axios = require('axios');
const graph = require('./graph')();
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

		let encryptedVertices = graph.encryptVertices(data.vertices);

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
			return result.data;
		} catch(e) {
			log.info(e);
		}

	}

}

module.exports = new DataReplication;