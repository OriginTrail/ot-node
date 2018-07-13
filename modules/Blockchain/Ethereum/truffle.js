const result = require('dotenv').config({ path: `${__dirname}/../../../.env` });
var HDWalletProvider = require('truffle-hdwallet-provider'); // eslint-disable-line import/no-unresolved

var mnemonic = process.env.TRUFFLE_MNEMONIC;

module.exports = {
    solc: {
        optimizer: {
          enabled: true,
          runs: 200,
        }
    },
    
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
            provider: () => new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/${process.env.RINKEBY_ACCESS_KEY}`),
            network_id: 4,
            gas: 4612388, // Gas limit used for deploys
        },
    },
};
