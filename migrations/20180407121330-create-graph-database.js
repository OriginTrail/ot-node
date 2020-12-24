
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('graph_database', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        database_system: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        username: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        password: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        host: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        port: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        max_path_length: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        database: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('graph_databases'),
};
