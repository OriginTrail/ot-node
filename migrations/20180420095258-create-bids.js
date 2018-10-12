
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('bids', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        offer_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        dc_node_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_size_in_bytes: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        litigation_interval_in_minutes: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        token_amount: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        chosen: {
            type: Sequelize.BOOLEAN,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('bids'),
};
