require('dotenv').config();

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('node_config', [{
        key: 'dh_min_price',
        value: 1e9,
    },
    {
        key: 'dh_max_price',
        value: 100e18,
    },
    {
        key: 'dh_max_data_size_bytes',
        value: 1000000,
    },
    {
        key: 'dh_max_stake',
        value: 1000e18,
    },
    ], {}),
    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('node_config', null, {}),
};
