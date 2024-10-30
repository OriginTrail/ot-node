export async function up({ context: { queryInterface } }) {
    await queryInterface.removeColumn('missed_paranet_asset', 'knowledge_asset_id');
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('missed_paranet_asset', 'knowledge_asset_id', {
        type: Sequelize.STRING,
        allowNull: false,
    });
}
