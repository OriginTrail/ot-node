export async function up({ context: { queryInterface } }) {
    await queryInterface.renameColumn('blockchain', 'blockchain_id', 'blockchain');

    await queryInterface.removeColumn('blockchain', 'contract');
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.renameColumn('blockchain', 'blockchain', 'blockchain_id');

    await queryInterface.addColumn('blockchain', 'contract', {
        type: Sequelize.STRING,
        primaryKey: true,
    });
}
