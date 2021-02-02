
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('node_status', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        hostname: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        timestamp: {
            allowNull: false,
            type: Sequelize.DATE,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('node_status'),
};
