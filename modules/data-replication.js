const https = require('https');
var utilities = require('./utilities')();
var config = utilities.getConfig();

class DataReplication {
	/**
	* Sends data to DH for replication
	*
	* @param json payload This is the payload to be sent
	* @return object response
	*/

	sendPayload(payload) {
		payload = JSON.stringify({
			payload: payload
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
				console.log(JSON.parse(data).explanation);
			});

		}).on('error', (err) => {
			console.log('Error: ' + err.message);
		});
	}
}

module.exports = new DataReplication;