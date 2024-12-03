export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.renameColumn('blockchain_event', 'blockchain_id', 'blockchain');

    await queryInterface.changeColumn('blockchain_event', 'block', {
        type: Sequelize.BIGINT,
    });

    await queryInterface.renameColumn('blockchain_event', 'block', 'block_number');

    await queryInterface.addColumn('blockchain_event', 'transaction_index', {
        type: Sequelize.BIGINT,
    });

    await queryInterface.addColumn('blockchain_event', 'log_index', {
        type: Sequelize.BIGINT,
    });

    await queryInterface.addColumn('blockchain_event', 'contract_address', {
        type: Sequelize.STRING,
    });
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.renameColumn('blockchain_event', 'block_number', 'block');

    await queryInterface.changeColumn('blockchain_event', 'block', {
        type: Sequelize.INTEGER,
    });

    await queryInterface.renameColumn('blockchain_event', 'blockchain', 'blockchain_id');

    await queryInterface.removeColumn('blockchain_event', 'transaction_index');

    await queryInterface.removeColumn('blockchain_event', 'log_index');

    await queryInterface.removeColumn('blockchain_event', 'contract_address');
}
