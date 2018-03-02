/* external modules */
const utilities = require('./utilities')();
const config = utilities.getConfig();
const Web3 = require('web3');
const contract = require('truffle-contract');

const provider = new Web3.providers.HttpProvider(config.blockchain.settings.ethereum.rpc_node+':'+config.blockchain.settings.ethereum.node_port);
const web3 = new Web3(provider);
const wallet_address = config.blockchain.settings.ethereum.wallet_address;

const VerifierArtifact = require('./contracts/Verifier');
const Verifier = contract(VerifierArtifact);
Verifier.setProvider(provider);


class EthSign {
	signMessage(message) {
		return web3.eth.sign(wallet_address, '0x' + EthSign.toHex(message));
	}

	getVerifierAddress(signature, message) {
		signature = signature.substr(2);
		let r = '0x' + signature.slice(0, 64);
		let s = '0x' + signature.slice(64, 128);
		let v = '0x' + signature.slice(128, 130);
		let v_decimal = web3.toDecimal(v);
		let messageSha = web3.sha3(message);
		Verifier.deployed().then(instance => {
			return instance.recoverAddr.call(
				messageSha,
				v_decimal,
				r,
				s
			);
		}).catch(e => {
			console.log('Signature verification error');
			console.log(e);
		});
	}

	async verify(signature, message) {
		return await this.getVerifierAddress(signature,message) === wallet_address;
	}

	static toHex(str) {
		let hex = '';
		for(let i=0;i<str.length;i++) {
			hex += ''+str.charCodeAt(i).toString(16);
		}
		return hex;
	}
}

module.exports = EthSign;