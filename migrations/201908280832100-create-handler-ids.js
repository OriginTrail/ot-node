
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('handler_ids', {
        handler_id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        data: {
            allowNull: true,
            type: Sequelize.TEXT,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('handler_ids'),
};
