require('dotenv').config();
const Utilities = require('../modules/Utilities');

const log = Utilities.getLogger();

if (!(process.env.NODE_WALLET && process.env.NODE_PRIVATE_KEY)) {
    log.error('You have to set node wallet and private key in .env');
    process.abort();
}

const runtimeConfig = Utilities.runtimeConfig();
if (!runtimeConfig) {
    log.error('Unknown environment. Please set environment.');
    process.abort();
}

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('blockchain_data', [{
        blockchain_title: 'Ethereum',
        network_id: 'rinkeby',
        gas_limit: '800000',
        gas_price: '5000000000',
        ot_contract_address: runtimeConfig.blockchainContracts.otContractAddress,
        token_contract_address: runtimeConfig.blockchainContracts.tokenContractAddress,
        escrow_contract_address: runtimeConfig.blockchainContracts.escrowContractAddress,
        bidding_contract_address: runtimeConfig.blockchainContracts.biddingContractAddress,
        reading_contract_address: runtimeConfig.blockchainContracts.readingContractAddress,
        rpc_node_host: 'https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt',
        rpc_node_port: '',
        wallet_address: process.env.NODE_WALLET,
        wallet_private_key: process.env.NODE_PRIVATE_KEY,
    }], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('blockchain_data', null, {}),
};
