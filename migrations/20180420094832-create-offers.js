
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('offers', {
        id: {
            allowNull: false,
            autoIncrement: false,
            primaryKey: true,
            type: Sequelize.INTEGER,
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
            type: Sequelize.STRING,
            allowNull: false,
        },
        dh_ids: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        start_tender_time: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('offers'),
};
