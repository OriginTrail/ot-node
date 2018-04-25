var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "<INSERT MNEOMONIC OF YOUR METAMASK HERE>";

module.exports = {
	networks: {
		development: {
			host: 'localhost',
			port: 8545,
			gas: 4000000,
			network_id: '*', // Match any network id
		},

		ganache: {
			host: 'localhost',
			port: 7545,
			gas: 4000000,
			network_id: '5777',
		},

		rinkeby: {
			provider: function() {
				return new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/<INSERT INFURA ACCESS KEY HERE>");
			},
			network_id: 3,
			gas: 4000000,
		},   
	},
};
