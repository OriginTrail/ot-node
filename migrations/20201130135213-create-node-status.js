
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('node_status', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        node_ip: {
            type: Sequelize.STRING,
        },
        status: {
            type: Sequelize.STRING,
        },
        timestamp: {
            type: Sequelize.INTEGER,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('node_status'),
};
