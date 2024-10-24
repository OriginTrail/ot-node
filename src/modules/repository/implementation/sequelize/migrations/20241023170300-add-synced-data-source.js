export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('paranet_synced_asset', 'data_source', {
        type: Sequelize.TEXT,
        allowNull: true,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('paranet_synced_asset', 'data_source');
}
