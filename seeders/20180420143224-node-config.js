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
        key: 'dh_max_stake',
        value: '1000',
    },
    {
        key: 'remote_control_enabled',
        value: '1',
    },
    {
        key: 'remote_control_port',
        value: process.env.NODE_REMOTE_CONTROL_PORT ?
            process.env.NODE_REMOTE_CONTROL_PORT : 3000,
    },
    {
        key: 'dh_stake_factor',
        value: '3500000000000', // ~ 5 TRAC per kB/day
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
        value: '14000000000000', // ~ 20 TRAC per kB/day
    },
    {
        key: 'total_escrow_time_in_milliseconds',
        value: 600000,
    },
    {
        key: 'max_token_amount_per_dh',
        value: '14000000000000', // ~ 20 TRAC per kB/day
    },
    {
        key: 'dh_min_stake_amount',
        value: '3500000000000', // ~ 5 TRAC per kB/day
    },
    {
        key: 'dh_min_reputation',
        value: 0,
    },
    ], {}),
    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('node_config', null, {}),
};
