export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('commands', 'priority', {
        type: Sequelize.BIGINT,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('commands', 'priority');
}
