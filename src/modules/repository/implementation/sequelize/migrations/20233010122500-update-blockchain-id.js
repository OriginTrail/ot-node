import { NODE_ENVIRONMENTS } from '../../../../../constants/constants.js';

// todo add real chain id
const chainIds = {
    [NODE_ENVIRONMENTS.TESTNET]: 1234,
    [NODE_ENVIRONMENTS.MAINNET]: 4321,
    [NODE_ENVIRONMENTS.DEVELOPMENT]: 5678,
};
const chainId = chainIds[process.env.NODE_ENV];

export async function up({ context: { queryInterface } }) {
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
        update service_agreement set blockchain_id='otp'
    `);

    await queryInterface.sequelize.query(`
        update blockchain_event set blockchain_id='otp'
    `);

    await queryInterface.sequelize.query(`
        update blockchain set blockchain_id='otp'
    `);
}
