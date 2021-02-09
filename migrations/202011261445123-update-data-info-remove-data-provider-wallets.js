const global_config = require('../config/config');

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'testnet';
}

const environmentConfig = global_config[process.env.NODE_ENV];
const blockchain_id = environmentConfig.blockchain.implementations[0].network_id;

module.exports = {
    up: async queryInterface => queryInterface.removeColumn('data_info', 'data_provider_wallet'),
    down: async (queryInterface, Sequelize) => queryInterface.addColumn(
        'data_info',
        'data_provider_wallet',
        {
            type: Sequelize.STRING(42),
        },
    ),
};
