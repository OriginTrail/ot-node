
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('node_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        value: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('node_data'),
};
