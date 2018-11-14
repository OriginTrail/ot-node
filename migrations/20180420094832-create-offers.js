
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('offers', {
        id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        data_set_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        offer_id: {
            type: Sequelize.INTEGER,
            unique: true,
        },
        litigation_interval_in_minutes: {
            type: Sequelize.INTEGER,
        },
        holding_time_in_minutes: {
            type: Sequelize.INTEGER,
        },
        token_amount_per_holder: {
            type: Sequelize.STRING,
        },
        red_litigation_hash: {
            type: Sequelize.STRING,
        },
        blue_litigation_hash: {
            type: Sequelize.STRING,
        },
        green_litigation_hash: {
            type: Sequelize.STRING,
        },
        task: {
            type: Sequelize.STRING,
        },
        status: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        message: {
            type: Sequelize.STRING,
            allowNull: false,
        },
        transaction_hash: {
            allowNull: true,
            type: Sequelize.STRING,
        },
    }),
    down: queryInterface => queryInterface.dropTable('offers'),
};
