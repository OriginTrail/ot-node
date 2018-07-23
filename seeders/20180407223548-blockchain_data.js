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
        ot_contract_address: '0x826b0e0b03f22c5e58557456bd8b8ede318c2e0a',
        token_contract_address: '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
        escrow_contract_address: '0x9b17c840450856aabb1c2695bbd86c34603f0b60',
        bidding_contract_address: '0xddc2ea417eb272b191a24a19b6a0ba458f954e61',
        reading_contract_address: '0x822d32cfccc4c8a5c167382f5e9abc32ac0d9b2e',
        rpc_node_host: 'https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt',
        rpc_node_port: '',
        wallet_address: process.env.NODE_WALLET,
        wallet_private_key: process.env.NODE_PRIVATE_KEY,
    }], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('blockchain_data', null, {}),
};
