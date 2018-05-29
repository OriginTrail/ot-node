
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('network_queries', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        query: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        timestamp: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },

    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('network_queries'),
};
