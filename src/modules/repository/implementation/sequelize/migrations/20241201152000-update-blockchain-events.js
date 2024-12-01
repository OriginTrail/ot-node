export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.renameColumn('blockchain_event', 'blockchain_id', 'blockchain');

    await queryInterface.changeColumn('blockchain_event', 'block', {
        type: Sequelize.BIGINT,
    });

    await queryInterface.addColumn('blockchain_event', 'priority', {
        type: Sequelize.BIGINT,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.renameColumn('blockchain_event', 'blockchain', 'blockchain_id');

    await queryInterface.changeColumn('blockchain_event', 'block', {
        type: Sequelize.INTEGER,
    });

    await queryInterface.removeColumn('blockchain_event', 'priority');
}
