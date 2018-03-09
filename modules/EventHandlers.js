const product = require('./product')();
const importer = require('./importer')();
const holding = require('./holding')();
const blockchain = require('./blockchain')();
const signing = require('./blockchain_interface/ethereum/signing')();
const utilities = require('./utilities')();
const log = utilities.getLogger();
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
			log.info('[DH] JSON imported');
			holding.addHoldingData(config.blockchain.settings.ethereum.wallet_address, this.queryObject.import_id, this.queryObject.public_key, () => {
				log.info('[DH] Holding data saved into database');
				this.emitResponse(socket, {
					status: 'success',
					code: 200,
					data: []
				});
			});

		});
	}

	testingRequest(socket) {
		log.info('[DH] Event emitted: Testing Request Response');
		
		this.emitResponse(socket, []);
	}

	async receiptRequest(socket) {
		await signing.sendConfirmation(confirmation, callback);
		log.info('[DH] Event emitted: Receipt Request Response');
		this.emitResponse(socket, []);
	}
}

module.exports = EventHandlers;