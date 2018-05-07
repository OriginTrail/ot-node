require('dotenv').config();
const log = require('../modules/Utilities').getLogger();

if (process.env.NODE_ENV !== 'test' && !(process.env.NODE_WALLET && process.env.NODE_PRIVATE_KEY)) {
    log.error('You have to set node wallet and private key in .env');
    process.kill(0);
}

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('blockchain_data', [{
        blockchain_title: 'Ethereum',
        network_id: 'rinkeby',
        gas_limit: '800000',
        gas_price: '5000000000',
        ot_contract_address: '0x8126e8a02bcae11a631d4413b9bd4f01f14e045d',
        token_contract_address: '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
        escrow_contract_address: '0xc45aa6d28392b6ade361e33d026b795dfd5b30c6',
        bidding_contract_address: '0x9ecffe681c93aa3987c3647e85b7aa7f967a71df',
        rpc_node_host: 'https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt',
        rpc_node_port: '80',
        wallet_address: process.env.NODE_WALLET,
        wallet_private_key: process.env.NODE_PRIVATE_KEY,
    }], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('blockchain_data', null, {}),
};
