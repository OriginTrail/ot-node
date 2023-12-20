const CHAIN_IDS = {
    development: 31337,
    test: 31337,
    devnet: 2160,
    testnet: 20430,
    mainnet: 2043,
};
const chainId = CHAIN_IDS[process.env.NODE_ENV];

export async function up({ context: { queryInterface } }) {
    await queryInterface.sequelize.query(`
        update shard set blockchain_id='otp:${chainId}'
    `);

    await queryInterface.sequelize.query(`
        update service_agreement set blockchain_id='otp:${chainId}'
    `);

    await queryInterface.sequelize.query(`
        update blockchain_event set blockchain_id='otp:${chainId}'
    `);

    await queryInterface.sequelize.query(`
        update blockchain set blockchain_id='otp:${chainId}'
    `);
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.sequelize.query(`
        update shard set blockchain_id='otp'
    `);

    await queryInterface.sequelize.query(`
        update service_agreement set blockchain_id='otp'
    `);

    await queryInterface.sequelize.query(`
        update blockchain_event set blockchain_id='otp'
    `);

    await queryInterface.sequelize.query(`
        update blockchain set blockchain_id='otp'
    `);
}
