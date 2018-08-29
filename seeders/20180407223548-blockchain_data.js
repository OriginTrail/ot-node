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
        escrow_contract_address: '0x6103d41059145b72f7ce5760910c017838454bca',
        bidding_contract_address: '0x4e3f704a3a8e874cf576606ed3b2a5e7bff37ad5',
        reading_contract_address: '0x35459b23d3eae1c82b8f349e9df4d28bc11ac5a9',
        rpc_node_host: 'https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt',
        rpc_node_port: '',
        wallet_address: process.env.NODE_WALLET,
        wallet_private_key: process.env.NODE_PRIVATE_KEY,
    }], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('blockchain_data', null, {}),
};
