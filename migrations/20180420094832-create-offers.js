
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('offers', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        import_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        total_escrow_time: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        max_token_amount: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        min_stake_amount: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        min_reputation: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        data_hash: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        data_size_bytes: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        dh_wallets: {
            type: Sequelize.JSON,
            allowNull: false,
        },
        dh_ids: {
            type: Sequelize.JSON,
            allowNull: false,
        },
        start_tender_time: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        status: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        message: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        external_id: {
            type: Sequelize.STRING,
            allowNull: false,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('offers'),
};
