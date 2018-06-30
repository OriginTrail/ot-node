
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('holding_data', {
        id: {
            allowNull: false,
            autoIncrement: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        source_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_public_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        distribution_public_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        distribution_private_key: {
            allowNull: true, // Only DH who got data from DC have it.
            type: Sequelize.STRING,
        },
        epk: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('holding_data'),
};
