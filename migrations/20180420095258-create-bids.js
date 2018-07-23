
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('bids', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        bid_index: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        price: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        import_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dc_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dc_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        total_escrow_time: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        stake: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_size_bytes: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        pd_bid: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            default: false,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('bids'),
};
