export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('commands', 'period', {
        type: Sequelize.BIGINT,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('commands', 'period', {
        type: Sequelize.BIGINT,
    });
}
