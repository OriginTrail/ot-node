import { CHAIN_IDS } from '../../../../../constants/constants.js';

const chainId = CHAIN_IDS[process.env.NODE_ENV];

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
