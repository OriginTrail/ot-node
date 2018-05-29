
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('holding_data', {
        id: {
            allowNull: false,
            autoIncrement: false,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        source_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_public_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_private_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('holding_data'),
};
