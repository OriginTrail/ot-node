
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('network_replies', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        data: {
            allowNull: false,
            type: Sequelize.JSON,
        },
        receiver_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        receiver_identity: {
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
