const result = require('dotenv').config({ path: `${__dirname}/../../../.env` });
// eslint-disable-next-line import/no-extraneous-dependencies
const HDWalletProvider = require('@truffle/hdwallet-provider');

const private_key = process.env.POLYGON_PRIVATE_KEY;
const rpc_endpoint = process.env.POLYGON_ACCESS_KEY;

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
        development: {
            host: 'localhost',
            port: 8545,
            gas: 6000000,
            network_id: '*', // Match any network id
        },
        testnet: {
            provider: () => new HDWalletProvider(private_key, rpc_endpoint),
            network_id: 80001,
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true,
        },
        updateContract: {
            provider: () => new HDWalletProvider(private_key, rpc_endpoint),
            network_id: 80001,
            gas: 6500000, // Gas limit used for deploys
            websockets: true,
            skipDryRun: true,
        },
        mainnet: {
            provider: () => new HDWalletProvider(private_key, rpc_endpoint),
            network_id: 137,
            gas: 6500000, // Gas limit used for deploys
            gasPrice: 40000000000,
            skipDryRun: true,
        },
    },
};
