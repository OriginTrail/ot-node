const utilities = require('../../utilities')();
const Web3 = require('web3');
const util = require('ethereumjs-util');
const signing = require('./signing');

const EventEmitter = require('events');
const transaction_event = new EventEmitter();

const config = utilities.getConfig();
const log = utilities.getLogger();


let transaction_queue = [];
let transaction_pending = false;

module.exports = function() {
	function signalNextInQueue(){
		transaction_queue.shift();
		transaction_pending = false;
		if(transaction_queue.length > 0){
			var next_transaction = String(transaction_queue[0]);
			transaction_event.emit(next_transaction);
		}
	}

	function readyFor(rawTx){
		return new Promise((resolve)=>{
			var tx_string = String(rawTx);
			transaction_event.on(tx_string, function(){
				resolve();
				});
			});
	}

	const tx_queue = {

		sendTransaction(rawTx, callback){
			return new Promise(
				async function(resolve, reject){
					queue.push(rawTx);
					if(transaction_pending)	await readyFor(tx);
					transaction_pending = true;
					signing.sendRaw(tx)
					.then(function(response){
						log.info('Transaction: ', response);
						signalNextInQueue();
						if (response.status === '0x0'){
							if (callback) utilities.executeCallback(callback, false);
							reject(response);
						}
						else {
							if (callback) utilities.executeCallback(callback, response);
							resolve(response);
							}
						})
					.catch(function(err){
						log.warn(err);
						if (callback) utilities.executeCallback(callback, false);
						signalNextInQueue();
						reject(err);
						});
					});
			},
		};

		return tx_queue;
	}