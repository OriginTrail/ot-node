export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('operation_ids', 'min_acks_reached', {
        type: Sequelize.BOOLEAN,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('operation_ids', 'min_acks_reached');
}
