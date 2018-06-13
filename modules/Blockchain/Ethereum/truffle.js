require('dotenv').config();
var HDWalletProvider = require('truffle-hdwallet-provider'); // eslint-disable-line import/no-unresolved

var mnemonic = process.env.TRUFFLE_MNEMONIC;

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
            gas: 6000000,
            network_id: '5777',
        },

        mock: {
            host: 'localhost',
            port: 7545,
            gas: 6000000,
            network_id: '5777',
        },

        test: {
            host: 'localhost',
            port: 7545,
            gas: 8000000,
            network_id: '5777',
        },

        rinkeby: {
            host: 'localhost', // Connect to geth on the specified
            port: 8545,
            from: '0xadcdb624b01692810fd00940c1b9dfa3dc47be4e', // default address to use for any transaction Truffle makes during migrations
            network_id: 4,
            gas: 4612388, // Gas limit used for deploys
        },
    },
};
