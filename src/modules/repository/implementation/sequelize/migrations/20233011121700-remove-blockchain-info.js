const chiadoBlockchainId = 'gnosis:10200';

export async function up({ context: { queryInterface } }) {
    await queryInterface.sequelize.query(`
        delete from blockchain where blockchain_id='${chiadoBlockchainId}'
    `);
}

// eslint-disable-next-line no-empty-function
export async function down() {}
