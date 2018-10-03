
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('replicated_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        dh_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        offer_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dh_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        color: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('replicated_data'),
};
