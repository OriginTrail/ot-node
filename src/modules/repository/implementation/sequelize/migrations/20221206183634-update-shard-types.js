export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('shard', 'ask', {
        type: Sequelize.STRING,
    });
    await queryInterface.changeColumn('shard', 'stake', {
        type: Sequelize.STRING,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.changeColumn('shard', 'ask', {
        type: Sequelize.INTEGER,
    });
    await queryInterface.changeColumn('shard', 'ask', {
        type: Sequelize.INTEGER,
    });
}
