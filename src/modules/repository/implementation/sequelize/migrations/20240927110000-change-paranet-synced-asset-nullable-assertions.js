export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('paranet_synced_asset', 'public_assertion_id', {
        type: Sequelize.STRING,
        allowNull: false,
    });

    await queryInterface.changeColumn('paranet_synced_asset', 'private_assertion_id', {
        type: Sequelize.STRING,
        allowNull: true,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('paranet_synced_asset', 'public_assertion_id', {
        type: Sequelize.STRING,
        allowNull: true,
    });

    await queryInterface.changeColumn('paranet_synced_asset', 'private_assertion_id', {
        type: Sequelize.STRING,
        allowNull: false,
    });
}
