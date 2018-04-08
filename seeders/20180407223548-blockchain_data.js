

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('blockchain_data', [{
        blockchain_title: 'Ethereum',
        network_id: 'rinkeby',
        gas_limit: '800000',
        gas_price: '5000000000',
        ot_contract_address: '0x8126e8a02bcae11a631d4413b9bd4f01f14e045d',
        token_contract_address: '0x98d9a611ad1b5761bdc1daac42c48e4d54cf5882',
        escrow_contract_address: '0x7cb42d3c63043fb9a6218c3663d5214ec5bcfd5a',
        rpc_node_host: 'https://rinkeby.infura.io/1WRiEqAQ9l4SW6fGdiDt',
        rpc_node_port: '80',
        wallet_address: '0xE1E9c5379C5df627a8De3a951fA493028394A050',
        wallet_private_key: 'd67bb11304e908bec02cdeb457cb16773676a89efbb8bed96d5f66aa1b49da75',
    }], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('blockchain_data', null, {}),
};
