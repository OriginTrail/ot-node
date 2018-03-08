const https = require('https');
var graph = require('./modules/graph')();
var utilities = require('./utilities')();
var config = utilities.getConfig();

class DataReplication {

	/**
	* Sends data to DH for replication
	*
	* @param json payload This is the payload to be sent
	* @return object response
	*/

	sendPayload(vertices) {
		let encryptedVerticas = graph.encryptVertices(vertices);

		const payload = JSON.stringify({
			payload: encryptedVerticas.vertices,
			publicKey: encryptedVerticas.public_key,
		});

		const options = {
			hostname: config.DH_NODE_IP,
			port: config.RPC_API_PORT,
			path: '/api/replication',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': payload.length
			}
		};

		https.post( options, (resp) => {
			let data = '';

			// A chunk of data has been recieved.
			resp.on('data', (chunk) => {
				data += chunk;
			});

			// The whole response has been received. Print out the result.
			resp.on('end', () => {
				return {
					status: 'OK',
					code: 200,
					messages: [],
					result: JSON.parse(data)
				};
			});

		}).on('error', (err) => {
			console.log('Error: ' + err.message);
		});
	}
}

module.exports = DataReplication;