
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('data_info', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        import_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data_provider_wallet: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        total_documents: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        total_data_blocks: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        root_hash: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        import_timestamp: {
            allowNull: false,
            type: Sequelize.DATE,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('data_infos'),
};
