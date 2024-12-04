import { NODE_ENVIRONMENTS } from '../../../../../constants/constants.js';

const MAINNET_GNOSIS_BLOCKCHAIN_ID = 'gnosis:100';

// eslint-disable-next-line import/prefer-default-export
export async function up({ context: { queryInterface } }) {
    if (process.env.NODE_ENV === NODE_ENVIRONMENTS.MAINNET) {
        await queryInterface.sequelize.query(`
            delete
            from service_agreement
            where score_function_id = 0
              and blockchain_id = '${MAINNET_GNOSIS_BLOCKCHAIN_ID}'
        `);

        await queryInterface.sequelize.query(`
            update service_agreement
            set last_commit_epoch = NULL
            where blockchain_id = '${MAINNET_GNOSIS_BLOCKCHAIN_ID}'
        `);
    }
}
