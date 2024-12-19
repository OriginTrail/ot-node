export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('commands', 'is_blocking', {
        type: Sequelize.BOOLEAN,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('commands', 'is_blocking');
}
