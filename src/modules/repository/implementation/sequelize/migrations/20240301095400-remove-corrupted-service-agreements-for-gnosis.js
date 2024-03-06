const GNOSIS_BLOCKCHAIN_ID = {
    mainnet: 'gnosis:100',
    testnet: 'gnosis:10200',
    devnet: 'gnosis:10200',
    development: 'hardhat2:31337',
};

const BLOCKCHAIN_ID =
    GNOSIS_BLOCKCHAIN_ID[process.env.NODE_ENV] ?? GNOSIS_BLOCKCHAIN_ID.development;

// eslint-disable-next-line import/prefer-default-export
export async function up({ context: { queryInterface } }) {
    await queryInterface.sequelize.query(`
        delete from service_agreement where score_function_id=0 and blockchain_id='${BLOCKCHAIN_ID}'
    `);

    await queryInterface.sequelize.query(`
        update service_agreement set last_commit_epoch = NULL where blockchain_id='${BLOCKCHAIN_ID}'
    `);
}
