require('dotenv').config();
const log = require('../modules/Utilities').getLogger();

if (!(process.env.NODE_WALLET && process.env.NODE_PRIVATE_KEY)) {
    log.error('You have to set node wallet and private key in .env');
    process.kill(0);
}

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('blockchain_data', [{
        blockchain_title: 'Ethereum',
        network_id: 'rinkeby',
        gas_limit: '800000',
        gas_price: '5000000000',
        ot_contract_address: '0xc47ab060e064e9291d723e14ddf4122bc121624b',
        token_contract_address: '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
        escrow_contract_address: '0xca5c15b2cf68fbc20148298f17e48617a71df63c',
        bidding_contract_address: '0xab1d06de6fb69de76739281cd0478931f9fff083',
        reading_contract_address: '0xe8d8277bc7a6587f150c6c65aeb688ac21082966',
        rpc_node_host: 'https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt',
        rpc_node_port: '',
        wallet_address: process.env.NODE_WALLET,
        wallet_private_key: process.env.NODE_PRIVATE_KEY,
    }], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('blockchain_data', null, {}),
};
