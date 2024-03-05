const GNOSIS_BLOCKCHAIN_ID = {
    MAINNET: 'gnosis:100',
    TESTNET: 'gnosis:10200',
    DEVNET: 'gnosis:10200',
    DEVELOPMENT: 'hardhat2:31337',
};

const BLOCKCHAIN_ID =
    GNOSIS_BLOCKCHAIN_ID[process.env.NODE_ENV] ?? GNOSIS_BLOCKCHAIN_ID.DEVELOPMENT;

// eslint-disable-next-line import/prefer-default-export
export async function up({ context: { queryInterface } }) {
    await queryInterface.sequelize.query(`
        delete from service_agreement where score_function_id=0 and blockchain_id='${BLOCKCHAIN_ID}'
    `);
}
