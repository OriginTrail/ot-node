
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('import_handles', {
        import_handle_id: {
            allowNull: false,
            primaryKey: true,
            type: Sequelize.STRING,
        },
        data: {
            allowNull: false,
            type: Sequelize.TEXT,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('import_handles'),
};
