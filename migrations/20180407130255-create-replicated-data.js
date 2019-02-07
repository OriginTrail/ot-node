
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
        dh_identity: {
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
            type: Sequelize.INTEGER,
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
            allowNull: false,
            type: Sequelize.STRING,
        },
        litigation_root_hash: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        distribution_root_hash: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        distribution_epk: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        confirmation: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('replicated_data'),
};
