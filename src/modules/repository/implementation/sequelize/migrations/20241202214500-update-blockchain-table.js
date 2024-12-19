export async function up({ context: { queryInterface } }) {
    const tableInfo = await queryInterface.describeTable('blockchain');

    if (tableInfo.blockchain_id) {
        await queryInterface.renameColumn('blockchain', 'blockchain_id', 'blockchain');
    }

    await queryInterface.sequelize.query(`
        DELETE t1
        FROM blockchain t1
        JOIN blockchain t2
        ON t1.blockchain = t2.blockchain
        AND (
            t1.last_checked_block > t2.last_checked_block OR
            (t1.last_checked_block = t2.last_checked_block AND t1.last_checked_timestamp > t2.last_checked_timestamp)
        );
    `);

    await queryInterface.sequelize.query(`
        ALTER TABLE blockchain DROP PRIMARY KEY, ADD PRIMARY KEY (blockchain);
    `);

    await queryInterface.removeColumn('blockchain', 'contract');
}

export async function down({ context: { queryInterface, Sequelize } }) {
    await queryInterface.renameColumn('blockchain', 'blockchain', 'blockchain_id');

    await queryInterface.addColumn('blockchain', 'contract', {
        type: Sequelize.STRING,
        allowNull: false,
    });

    await queryInterface.sequelize.query(`
        ALTER TABLE blockchain DROP PRIMARY KEY, ADD PRIMARY KEY (blockchain_id, contract);
    `);
}
