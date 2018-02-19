var utilities = require('../../utilities')();
var Web3 = require('web3');
var fs = require('fs');

var util = require('ethereumjs-util');
var tx = require('ethereumjs-tx');

var lightwallet = require('eth-lightwallet');
var txutils = lightwallet.txutils;

var config = utilities.getConfig();

var contract_abi = config.blockchain.settings.ethereum.contract_abi;
var private_key = config.blockchain.settings.ethereum.private_key;

var contract_address = config.blockchain.settings.ethereum.contract_address;
var wallet_address = config.blockchain.settings.ethereum.wallet_address;

var web3 = new Web3(new Web3.providers.HttpProvider(config.blockchain.settings.ethereum.rpc_node+":"+config.blockchain.settings.ethereum.node_port));
var contract_abi_path = config.blockchain.settings.ethereum.contract_abi;
var contract_abi_file = fs.readFileSync(contract_abi_path);
var contract_abi = JSON.parse(contract_abi_file);

var nonce = parseInt(web3.toHex(web3.eth.getTransactionCount(wallet_address, 'pending')));
var nonce_increment = 0;

module.exports = function() {

	function sendRaw(rawTx) {
		    var privateKey = new Buffer(private_key, 'hex');
		    var transaction = new tx(rawTx);
		    transaction.sign(privateKey);
		    var serializedTx = transaction.serialize().toString('hex');
		    web3.eth.sendRawTransaction(
		    '0x' + serializedTx, function(err, result) {
		        if(err) {
		            console.log(err);
		        } else {
		            console.log('Transaction: ', result);
		        }
		    });
		}      

	var signing = {

		signAndSend: function(batch_id, batch_id_hash, graph_hash) {

			var new_nonce = nonce + nonce_increment;
			nonce_increment = nonce_increment + 1;

			var txOptions = {
			    nonce: new_nonce,
			    gasLimit: web3.toHex(config.blockchain.settings.ethereum.gas_limit),
			    gasPrice: web3.toHex(config.blockchain.settings.ethereum.gas_price),
			    to: contract_address
			}

			console.log(txOptions)

			var rawTx = txutils.functionTx(contract_abi, 'addFingerPrint', [batch_id,batch_id_hash, graph_hash], txOptions);
			sendRaw(rawTx);
		}
	}

	return signing;
}

