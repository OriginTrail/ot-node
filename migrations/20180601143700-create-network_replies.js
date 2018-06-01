
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('network_replies', {
        id: {
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
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
    down: (queryInterface, Sequelize) => queryInterface.dropTable('network_replies'),
};
