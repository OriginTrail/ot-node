require('dotenv').config();

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('node_config', [{
        key: 'dh_min_price',
        value: '10',
    },
    {
        key: 'dh_max_price',
        value: '1000',
    },
    {
        key: 'dh_max_data_size_bytes',
        value: '1000000',
    },
    {
        key: 'dh_max_stake',
        value: '1000',
    },
    {
        key: 'remote_control_enabled',
        value: '1',
    },
    {
        key: 'remote_control_port',
        value: process.env.NODE_REMOTE_CONTROL_PORT,
    },
    {
        key: 'dh_stake_factor',
        value: '1',
    },
    {
        key: 'read_stake_factor',
        value: '1',
    },
    {
        key: 'dh_max_time_mins',
        value: '100000',
    },
    {
        key: 'dh_price',
        value: 2,
    },
    ], {}),
    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('node_config', null, {}),
};
