export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('publish', 'agreementId', {
        type: Sequelize.STRING,
    });
    await queryInterface.addColumn('publish', 'agreementStatus', {
        type: Sequelize.STRING,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('publish', 'agreementId');
    await queryInterface.removeColumn('publish', 'agreementStatus');
}
