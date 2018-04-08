
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('replicated_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        dh_id: {
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
        total_amount: {
            type: Sequelize.REAL,
        },
        dh_stake: {
            type: Sequelize.REAL,
        },
        my_stake: {
            type: Sequelize.REAL,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('replicated_data'),
};
