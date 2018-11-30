
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('holding_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        data_set_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        source_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        litigation_public_key: {
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
        distribution_epk: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        transaction_hash: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        color: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('holding_data'),
};
