
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('purchased_data', {
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
        transaction_hash: {
            allowNull: true,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('purchased_data'),
};
