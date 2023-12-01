export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('event', 'blockchain_id', {
        type: Sequelize.STRING,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('event', 'blockchain_id');
}
