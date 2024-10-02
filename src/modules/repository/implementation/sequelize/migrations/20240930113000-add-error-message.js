export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('missed_paranet_asset', 'error_message', {
        type: Sequelize.TEXT,
        allowNull: true,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('missed_paranet_asset', 'error_message');
}
