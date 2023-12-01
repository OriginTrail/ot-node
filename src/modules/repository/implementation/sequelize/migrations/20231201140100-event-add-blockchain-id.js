export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('event', 'blockchainId', {
        type: Sequelize.STRING,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('event', 'blockchainId');
}
