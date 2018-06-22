require('dotenv').config();

if (process.env.NEO_DATABASE && process.env.NEO_PORT && process.env.NEO_HOST &&
    process.env.NEO_PASSWORD && process.env.NEO_USERNAME) {
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
        {
            database_system: 'neo4j',
            username: process.env.NEO_USERNAME,
            password: process.env.NEO_PASSWORD,
            host: process.env.NEO_HOST,
            port: process.env.NEO_PORT,
            max_path_length: 1000,
            database: process.env.NEO_DATABASE,
        },
        ], {}),

        down: (queryInterface, Sequelize) => queryInterface.bulkDelete('graph_database', null, {}),
    };
} else {
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
}
