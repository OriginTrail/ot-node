export async function up({ context: { queryInterface } }) {
    await queryInterface.renameColumn('blockchain', 'blockchain_id', 'blockchain');
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.renameColumn('blockchain', 'blockchain', 'blockchain_id');
}
