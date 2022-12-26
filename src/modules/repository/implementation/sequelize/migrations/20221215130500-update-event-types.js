export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('event', 'value1', {
        type: Sequelize.TEXT,
    });
    await queryInterface.changeColumn('event', 'value2', {
        type: Sequelize.TEXT,
    });
    await queryInterface.changeColumn('event', 'value3', {
        type: Sequelize.TEXT,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('event', 'value1', {
        type: Sequelize.STRING,
    });
    await queryInterface.changeColumn('event', 'value2', {
        type: Sequelize.STRING,
    });
    await queryInterface.changeColumn('event', 'value3', {
        type: Sequelize.STRING,
    });
}
