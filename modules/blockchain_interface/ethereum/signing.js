var utilities = require('../../utilities')();
var Web3 = require('web3');
var fs = require('fs');
var util = require('ethereumjs-util');
var tx = require('ethereumjs-tx');
var lightwallet = require('eth-lightwallet');
var Account = require("eth-lib/lib/account");
var Hash = require("eth-lib/lib/hash");
var BN = require('bn.js');
var abi = require('ethereumjs-abi');
var txutils = lightwallet.txutils;
var config = utilities.getConfig();
const log = utilities.getLogger();

var wallet_address = config.blockchain.settings.ethereum.wallet_address;
var private_key = config.blockchain.settings.ethereum.private_key;

var web3 = new Web3(new Web3.providers.HttpProvider(config.blockchain.settings.ethereum.rpc_node+":"+config.blockchain.settings.ethereum.node_port));


// OT contract data
var contract_address = config.blockchain.settings.ethereum.contract_address;
var contract_abi_path = config.blockchain.settings.ethereum.contract_abi;
var contract_abi_file = fs.readFileSync(contract_abi_path);
var contract_abi = JSON.parse(contract_abi_file);

// Token contract data
var token_address = config.blockchain.settings.ethereum.token_contract;
var token_abi_path = config.blockchain.settings.ethereum.token_abi;
var token_abi_file = fs.readFileSync(token_abi_path);
var token_abi = JSON.parse(token_abi_file);

// Escrow contract data
var escrow_address = config.blockchain.settings.ethereum.escrow_contract;
var escrow_abi_path = config.blockchain.settings.ethereum.escrow_abi;
var escrow_abi_file = fs.readFileSync(escrow_abi_path);
var escrow_abi = JSON.parse(escrow_abi_file);

/*
console.log('------------------------');
var nonce = 5;
web3.eth.getTransactionCount("0x11f4d0A3c12e86B4b5F39B213F7E19D048276DAe",web3.eth.defaultBlock,function(err, result) {
}).then(function (nonce){console.log(nonce)})
console.log('------------------------');*/



module.exports = function() {

	function sendRaw(rawTx, callback) {
		var privateKey = new Buffer(private_key, 'hex');
		var transaction = new tx(rawTx);
		transaction.sign(privateKey);
		var serializedTx = transaction.serialize().toString('hex');
		return web3.eth.sendSignedTransaction('0x' + serializedTx);
	}

	function sendTransaction(abi, method, args, txOptions) {
		return new Promise((resolve, reject) => {
			web3.eth.getTransactionCount(wallet_address).then(nonce => {

				txOptions.nonce = nonce;

				//log.info(method);
				log.warn(txOptions);

				var rawTx = txutils.functionTx(abi, method, args, txOptions);
				return sendRaw(rawTx).on('error', err => {
					return reject(err);
				}).then(response => {
					if(response.error == '0x0') {
						reject(response);
					}  else {
						return resolve(response);
					}
				}).catch(err => {
					reject(err);
				});

			});
		});
	}

	var signing = {

		signAndSend: function(batch_id, batch_id_hash, graph_hash) {

			var txOptions = {
				gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
				gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
				to: contract_address
			};

			return sendTransaction(contract_abi, 'addFingerPrint', [batch_id,batch_id_hash, graph_hash], txOptions);
		},

		signAndAllow: function(options) {

			var approvalFunction = this.listenApproval;
			var createEscrowFunction = this.createEscrow;

			return new Promise((resolve, reject) => {

				var txOptions = {
					gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
					gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
					to: token_address
				};

				sendTransaction(token_abi, 'increaseApproval', [escrow_address, options.amount], txOptions).then(function(response) {
					//log.info(response);
					
					log.info('Creating Escrow...');
					createEscrowFunction(options.dh_wallet, options.import_id, options.amount, options.start_time, options.total_time).then( result => {
						log.info('Escrow created');
						resolve(result);
					}).catch(e => {
						log.error('Escrow creation failed');
						reject(e);
					});


				}).catch(e => {
					log.error('Not Approved!');
					console.log(e);
					reject(e);
				});
			});
		},

		createEscrow: function(DH_wallet, data_id, token_amount, start_time, total_time, callback) {

			var txOptions = {
				gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
				gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
				to: escrow_address
			};

			return sendTransaction(escrow_abi, 'initiateEscrow', [DH_wallet, data_id, token_amount, start_time, total_time], txOptions);
		},

		createConfirmation: function(DH_wallet, data_id, confirmation_verification_number, confirmation_time, confirmation_valid){

			/*
			address DC_wallet, uint data_id,
			uint confirmation_verification_number, uint confirmation_time, bool confirmation_valid,
			bytes32 confirmation_hash, uint8 v, bytes32 r, bytes32 s
			*/

			// (msg.sender, data_id, confirmation_verification_number, confirmation_time, confirmation_valid) == confirmation_hash
			var raw_data = "0x" + abi.soliditySHA3(
				["address", "uint", "uint", "uint", "bool"],
				[new BN(DH_wallet, 16), data_id, confirmation_verification_number, confirmation_time, confirmation_valid]
			).toString('hex');

			var hash = utilities.sha3(raw_data);
			var signature = Account.sign(hash, '0x' + private_key);
			var vrs = Account.decodeSignature(signature);
			s = {
				message: raw_data,
				messageHash: hash,
				v: vrs[0],
				r: vrs[1],
				s: vrs[2],
				signature: signature
			};

			var confirmation = {
				DC_wallet: wallet_address,
				data_id: data_id,
				confirmation_verification_number: confirmation_verification_number,
				confirmation_time: confirmation_time,
				confirmation_valid: confirmation_valid,
				v: s.v,
				r: s.r,
				s: s.s,
				confirmation_hash: s.message
			};

			return confirmation;
		},

		sendConfirmation: async function(confirmation, callback) {

			var txOptions = {
				gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
				gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
				to: escrow_address
			};


			sendTransaction(escrow_abi, 'payOut', [confirmation.DC_wallet,
				confirmation.data_id, 
				confirmation.confirmation_verification_number, 
				confirmation.confirmation_time, 
				confirmation.confirmation_valid, 
				confirmation.confirmation_hash, 
				confirmation.v, 
				confirmation.r, 
				confirmation.s], txOptions).then(response => {
				log.info('Confirmation complete');
				console.log(response);
			}).catch(err => {
				log.warn('Confirmation failed');
				console.log("ERROR: " + err);
			});
		}

	};

	return signing;
};

