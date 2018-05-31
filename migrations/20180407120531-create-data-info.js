
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('data_info', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        import_id: {
            type: Sequelize.STRING,
        },
        total_documents: {
            type: Sequelize.INTEGER,
        },
        total_data_blocks: {
            type: Sequelize.INTEGER,
        },
        root_hash: {
            type: Sequelize.STRING,
        },
        import_timestamp: {
            type: Sequelize.DATE,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('data_infos'),
};
