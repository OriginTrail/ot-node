export async function up({ context: { queryInterface } }) {
    const tableInfo = await queryInterface.describeTable('blockchain');

    if (tableInfo.blockchain_id) {
        await queryInterface.renameColumn('blockchain', 'blockchain_id', 'blockchain');
    }
    await queryInterface.removeIndex('blockchain', 'contract_index');
    await queryInterface.removeColumn('blockchain', 'contract');
}

export async function down({ context: { queryInterface, Sequelize } }) {
    const tableInfo = await queryInterface.describeTable('blockchain');
    if (tableInfo.blockchain) {
        await queryInterface.renameColumn('blockchain', 'blockchain', 'blockchain_id');
    }

    await queryInterface.addColumn('blockchain', 'contract', {
        type: Sequelize.STRING,
        primaryKey: true,
    });
}
