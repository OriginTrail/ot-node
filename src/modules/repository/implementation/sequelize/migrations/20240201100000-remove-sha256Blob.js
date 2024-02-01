export async function up({ context: { queryInterface } }) {
    const tableInfo = await queryInterface.describeTable('shard');

    if (tableInfo.sha256_blob) {
        await queryInterface.removeColumn('shard', 'sha256_blob');
    }
}

export async function down({ context: { queryInterface, Sequelize } }) {
    const tableInfo = await queryInterface.describeTable('shard');

    if (!tableInfo.sha256_blob) {
        await queryInterface.addColumn('shard', 'sha256_blob', {
            type: Sequelize.BLOB,
        });
    }
}
