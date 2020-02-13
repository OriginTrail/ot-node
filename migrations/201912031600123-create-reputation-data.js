
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('reputation_data', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        dh_identity: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        offer_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        reputation_delta: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        timestamp: {
            type: Sequelize.INTEGER,
            allowNull: true,
        },
    }),
    down: queryInterface => queryInterface.dropTable('reputation_data'),
};
