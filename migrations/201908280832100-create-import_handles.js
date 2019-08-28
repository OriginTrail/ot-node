
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('import_handles', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        import_handle_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        status: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('import_handles'),
};
