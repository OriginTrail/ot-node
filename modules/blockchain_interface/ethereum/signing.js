var utilities = require('../../utilities')();
var Web3 = require('web3');
var fs = require('fs');
var util = require('ethereumjs-util');
var tx = require('ethereumjs-tx');
var lightwallet = require('eth-lightwallet');
var txutils = lightwallet.txutils;
var config = utilities.getConfig();

var wallet_address = config.blockchain.settings.ethereum.wallet_address;
var private_key = config.blockchain.settings.ethereum.private_key;

var web3 = new Web3(new Web3.providers.HttpProvider(config.blockchain.settings.ethereum.rpc_node+':'+config.blockchain.settings.ethereum.node_port));

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


var nonce = -1;
var nonce_increment = 0;

module.exports = function() {

	function sendRaw(rawTx, callback) {
		    var privateKey = new Buffer(private_key, 'hex');
		    var transaction = new tx(rawTx);
		    transaction.sign(privateKey);
		    var serializedTx = transaction.serialize().toString('hex');
		    web3.eth.sendSignedTransaction(
		    '0x' + serializedTx, function(err, result) {
		        if(err) {
		            console.log(err);

		            if(callback) {
		            	utilities.executeCallback(callback, false);
		            }
		        } else {
		        	if(callback) {
		            	utilities.executeCallback(callback, result);
		            }
		            console.log('Transaction: ', result);
		        }
		    });
	}

	var signing = {

		signAndSend: async function(batch_id, batch_id_hash, graph_hash) {

			if(nonce == -1)
				nonce = await web3.eth.getTransactionCount(wallet_address);

			console.log(nonce);

			var new_nonce = nonce + nonce_increment;
			nonce_increment = nonce_increment + 1;

			var txOptions = {
			    nonce: new_nonce,
			    gasLimit: web3.util.toHex(config.blockchain.settings.ethereum.gas_limit),
			    gasPrice: web3.util.toHex(config.blockchain.settings.ethereum.gas_price),
			    to: contract_address
			};

			console.log(txOptions);

			var rawTx = txutils.functionTx(contract_abi, 'addFingerPrint', [batch_id,batch_id_hash, graph_hash], txOptions);
			sendRaw(rawTx);
		},

		signAndAllow: async function(amount, callback) {

			if(nonce == -1)
				nonce = await web3.eth.getTransactionCount(wallet_address);

			var new_nonce = nonce + nonce_increment;
			nonce_increment = nonce_increment + 1;

			var txOptions = {
			    nonce: new_nonce,
			    gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
			    gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
			    to: token_address
			};

			console.log(txOptions);

			var rawTx = txutils.functionTx(token_abi, 'approve', [escrow_address, amount], txOptions);
			sendRaw(rawTx, callback);
		},

		createEscrow: async function(DC_wallet, DH_wallet, data_id, token_amount, start_time, total_time, callback) {

			if(nonce == -1)
				nonce = await web3.eth.getTransactionCount(wallet_address);

			var new_nonce = nonce + nonce_increment;
			nonce_increment = nonce_increment + 1;

			var txOptions = {
			    nonce: new_nonce,
			    gasLimit: web3.utils.toHex(config.blockchain.settings.ethereum.gas_limit),
			    gasPrice: web3.utils.toHex(config.blockchain.settings.ethereum.gas_price),
			    to: escrow_address
			};

			console.log(txOptions);

			var rawTx = txutils.functionTx(escrow_abi, 'initiateEscrow', [DC_wallet, DH_wallet, data_id, token_amount, start_time, total_time], txOptions);
			sendRaw(rawTx, callback);
		},

		signCheque: function(receiver_wallet, data_id)
		{
			message = wallet_address + '|' + receiver_wallet + '|' + data_id;
			signed = web3.eth.accounts.sign(message, private_key);

			return signed;
		},

		verifyMessageSignature: function(message, signer_address)
		{
			var recovered_address = web3.eth.accounts.recover(message, message.v, message.r, message.s);

			var message_data = message.message;
			var message_hash = message.messageHash;

			var hashed_message = utilities.sha3(`\x19Ethereum Signed Message:\n${message_data.length}${message_data.data}`);

			return recovered_address == signer_address && message_hash == hashed_message;
		},

		parseMessage: function(message_data) {
			var message_elements = message_data.split('|');

			var parsed_message = {
				sender: message_elements[0],
				receiver: message_elements[1],
				amount: message_elements[2]
			};

			return parsed_message;
		},

		isValidMessage: function(sender_wallet, receiver_wallet, message) {
			
			var is_message_signed = verifyMessageSignature(message, sender_wallet);

			if(is_message_signed == false)
			{
				return false;
			}

			var parsed_message = parseMessage(message.message);

			if(parsed_message.sender != sender_wallet || parsed_message.receiver != receiver_wallet)
			{
				return false;
			}

			return true;
		}


	};

	return signing;
};

