

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.bulkInsert('graph_database', [{
        database_system: 'arango_db',
        username: 'root',
        password: 'root',
        host: 'localhost',
        port: 8529,
        max_path_length: 1000,
        database: 'origintrail',
    }], {}),

    down: (queryInterface, Sequelize) => queryInterface.bulkDelete('graph_database', null, {}),
};
