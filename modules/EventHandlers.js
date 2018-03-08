const product = require('./product')();
const importer = require('./importer')();
const holding = require('./holding')();
const blockchain = require('./blockchain')();
const utilities = require('./utilities')();
const config = utilities.getConfig();

class EventHandlers {

	constructor(data, socket) {
		//kebab-case to snakeCase
		this.event = data.request.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });

		//get the first part of some-response => some
		this.eventPrefix = data.request.split(/-(.+)/)[0];

		this.queryObject = data.queryObject;
		this.clientRequest = data.clientRequest;

		try {
			this[this.event](socket);
		} catch(err) {
			socket.emit('event', {
				response: 'Unsupported event'
			});
		}
	}

	emitResponse(socket, response) {
		socket.emit('event', {
			response: this.eventPrefix + '-response',
			responseData: response,
			clientRequest: this.clientRequest
		});
	}

	trailRequest(socket){
		product.getTrailByQuery(this.queryObject, (response) => {
			this.emitResponse(socket, response);
		});
	}

	importRequest(socket) {
		importer.importXML(this.queryObject.filepath, (response) => {
			this.emitResponse(socket, response);
		});
	}

	blockchainRequest(socket) {
		let batch_uid_hash = utilities.sha3(this.queryObject.batch_uid);
		blockchain.getFingerprint(this.queryObject.owner, batch_uid_hash, (response) => {
			this.emitResponse(socket, response);

		});
	}

	expirationRequest(socket) {
		product.getExpirationDates(this.queryObject, (response) => {
			this.emitResponse(socket, response);
		});
	}

	replicationRequest(socket) {
		importer.importJSON(this.queryObject,  () =>  {
			holding.addHoldingData(config.WALLET_ID, this.queryObject.import_id, this.queryObject.public_key, () => {
				this.emitResponse(socket, {
					status: 'success',
					code: 200,
					data: []
				});
			});

		});
	}

	testingRequest(socket) {
		//this.emitResponse(socket, response);
	}

	receiptRequest(socket) {
		//this.emitResponse(socket, response);
	}
}

module.exports = EventHandlers;