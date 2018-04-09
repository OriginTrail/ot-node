
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('graph_database', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        database_system: {
            type: Sequelize.STRING,
        },
        username: {
            type: Sequelize.STRING,
        },
        password: {
            type: Sequelize.STRING,
        },
        host: {
            type: Sequelize.STRING,
        },
        port: {
            type: Sequelize.INTEGER,
        },
        max_path_length: {
            type: Sequelize.INTEGER,
        },
        database: {
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('graph_databases'),
};
