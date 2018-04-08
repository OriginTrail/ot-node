
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('holding_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        dc_id: {
            type: Sequelize.INTEGER,
        },
        data_id: {
            type: Sequelize.INTEGER,
        },
        start_time: {
            type: Sequelize.DATE,
        },
        end_time: {
            type: Sequelize.DATE,
        },
        total_token_amount: {
            type: Sequelize.REAL,
        },
        data_size: {
            type: Sequelize.REAL,
        },
        my_stake: {
            type: Sequelize.REAL,
        },
        dc_stake: {
            type: Sequelize.REAL,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('holding_data'),
};
