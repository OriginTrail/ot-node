
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('data_providers', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        ip: {
            type: Sequelize.STRING,
        },
        description: {
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('data_providers'),
};
