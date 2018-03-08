// External modules
var unirest = require('unirest');
var kademlia = require('./kademlia')();
var utilities = require('./utilities')();
var config = utilities.getConfig();

module.exports = function () {
	var replication = {

		replicate: function (input_file) {
			kademlia.clearPingResponses();
			kademlia.waitForResponse();

			var reqNum = utilities.getRandomInt(10000000000);

			kademlia.sendRequest('ot-ping-request', {
				request_id: reqNum,
				sender_ip: config.NODE_IP,
				sender_port: config.RPC_API_PORT
			});

			setTimeout(function () {
				kademlia.stopWaitingForResponse();

				var responses = kademlia.getPingResponses();

				for (var i in responses) {
					unirest.post('http://' + responses[i].sender_ip + ':' + responses[i].sender_port + '/import')
						.headers({
							'Content-Type': 'multipart/form-data'
						})
						.field('noreplicate', true)
						.attach('importfile', input_file)
						.end(function (response) {
							console.log('Replication response : ' + JSON.stringify(response.body));
						});
				}
			}, parseInt(config.REQUEST_TIMEOUT));
		}

	};

	return replication;
};
