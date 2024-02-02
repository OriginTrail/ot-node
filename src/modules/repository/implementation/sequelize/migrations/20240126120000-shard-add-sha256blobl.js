export async function up({ context: { queryInterface, Sequelize } }) {
    const tableInfo = await queryInterface.describeTable('shard');

    if (!tableInfo.sha256_blob) {
        await queryInterface.addColumn('shard', 'sha256_blob', {
            type: Sequelize.BLOB,
        });
    }
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('shard', 'sha256_blob');
}
