export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('commands', 'ready_at', {
        type: Sequelize.BIGINT,
    });
    await queryInterface.changeColumn('commands', 'delay', {
        type: Sequelize.BIGINT,
    });
    await queryInterface.changeColumn('commands', 'started_at', {
        type: Sequelize.BIGINT,
    });
    await queryInterface.changeColumn('commands', 'deadline_at', {
        type: Sequelize.BIGINT,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('commands', 'ready_at', {
        type: Sequelize.INTEGER,
    });
    await queryInterface.changeColumn('commands', 'delay', {
        type: Sequelize.INTEGER,
    });
    await queryInterface.changeColumn('commands', 'started_at', {
        type: Sequelize.INTEGER,
    });
    await queryInterface.changeColumn('commands', 'deadline_at', {
        type: Sequelize.INTEGER,
    });
}
