
module.exports = {
    down: (queryInterface, Sequelize) => queryInterface.createTable('fake_table', {
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
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    up: (queryInterface, Sequelize) => queryInterface.dropTable('fake_table'),
};
