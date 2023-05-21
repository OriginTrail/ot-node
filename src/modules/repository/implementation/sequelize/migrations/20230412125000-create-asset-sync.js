export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.createTable('asset_sync', {
        blockchain_id: {
            allowNull: false,
            type: Sequelize.STRING,
            primaryKey: true,
        },
        asset_storage_contract: {
            allowNull: false,
            type: Sequelize.STRING,
            primaryKey: true,
        },
        token_id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
        },
        state_index: {
            type: Sequelize.INTEGER,
            allowNull: false,
            primaryKey: true,
        },
        status: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        inserted_by_command: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            defaultValue: true,
        },
        created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
        updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('NOW()'),
        },
    });
}
export async function down({ context: { queryInterface } }) {
    await queryInterface.dropTable('asset_sync');
}
