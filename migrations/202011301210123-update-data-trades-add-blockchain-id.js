const global_config = require('../config/config');

if (!process.env.NODE_ENV) {
    // Environment not set. Use the production.
    process.env.NODE_ENV = 'testnet';
}
const environmentConfig = global_config[process.env.NODE_ENV];
const blockchain_id = environmentConfig.blockchain.implementations[0].network_id;

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'data_trades',
            'blockchain_id',
            {
                type: Sequelize.STRING,
            },
        );

        await queryInterface.sequelize.query(`UPDATE data_trades SET blockchain_id = '${blockchain_id}'`);

        await queryInterface.changeColumn(
            'data_trades',
            'blockchain_id',
            {
                type: Sequelize.STRING,
                allowNull: false,
            },
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('data_trades', 'blockchain_id');
    },
};
