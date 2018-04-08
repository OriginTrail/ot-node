
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('blockchain_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        blockchain_title: {
            type: Sequelize.STRING,
        },
        network_id: {
            type: Sequelize.STRING,
        },
        gas_limit: {
            type: Sequelize.INTEGER,
        },
        gas_price: {
            type: Sequelize.INTEGER,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('blockchain_data'),
};
