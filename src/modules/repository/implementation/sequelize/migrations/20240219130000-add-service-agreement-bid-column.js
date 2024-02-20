export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('service_agreement', 'tokenAmount', {
        type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('service_agreement', 'updateTokenAmount', {
        type: Sequelize.INTEGER,
    });

    await queryInterface.addColumn('service_agreement', 'bid', {
        type: Sequelize.FLOAT.UNSIGNED,
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('service_agreement', 'bid');
    await queryInterface.removeColumn('service_agreement', 'updateTokenAmount');
    await queryInterface.removeColumn('service_agreement', 'tokenAmount');
}
