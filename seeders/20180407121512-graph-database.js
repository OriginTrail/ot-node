require('dotenv').config();

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('graph_database', [{
        database_system: 'arango_db',
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        max_path_length: 1000,
        database: process.env.DB_DATABASE,
    },
    ], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('graph_database', null, {}),
};
