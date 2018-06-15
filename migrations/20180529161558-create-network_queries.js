
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('network_queries', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        query: {
            allowNull: false,
            type: Sequelize.JSON,
        },
        timestamp: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('network_queries'),
};
