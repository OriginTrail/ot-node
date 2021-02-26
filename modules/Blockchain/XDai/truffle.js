const result = require('dotenv').config({ path: `${__dirname}/../../../.env` });
var HDWalletProvider = require('truffle-hdwallet-provider'); // eslint-disable-line import/no-unresolved

var mnemonic = process.env.TRUFFLE_MNEMONIC;
const privateKey = process.env.XDAI_PRIVATE_KEY;
const rpc_endpoint = process.env.XDAI_ACCESS_KEY;

module.exports = {
    compilers: {
        solc: {
            settings: {
                optimizer: {
                    enabled: true,
                    runs: 200,
                },
            },
        },
    },

    networks: {
        ganache: {
            host: 'localhost',
            port: 7545,
            gas: 6000000,
            network_id: '5777',
        },

        test: {
            host: 'localhost',
            port: 7545,
            gas: 6000000,
            network_id: '5777',
        },

        contracts: {
            provider: () => new HDWalletProvider(privateKey, rpc_endpoint),
            network_id: 100,
            gasPrice: 1000000000,
            websockets: false,
            skipDryRun: true,
        },

        token: {
            provider: () => new HDWalletProvider(privateKey, `${process.env.XDAI_ACCESS_KEY}`),
            network_id: 100,
            gas: 1700000, // Gas limit used for deploys
            gasPrice: 1000000000,
            websockets: false,
            skipDryRun: true,
        },

        xdai: {
            network_id: 1,
            gas: 1700000, // Gas limit used for deploys
            websockets: true,
            skipDryRun: true,
        },
    },
};
