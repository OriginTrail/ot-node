export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('paranet_synced_asset', 'data_source', {
        type: Sequelize.ENUM('sync', 'local_store'),
        allowNull: true,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('paranet_synced_asset', 'data_source', {
        type: Sequelize.TEXT,
        allowNull: true,
    });
}
