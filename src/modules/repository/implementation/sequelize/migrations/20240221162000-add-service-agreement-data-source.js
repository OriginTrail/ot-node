import { SERVICE_AGREEMENT_SOURCES } from '../../../../../constants/constants.js';

export async function up({ context: { queryInterface, Sequelize } }) {
    await queryInterface.addColumn('service_agreement', 'data_source', {
        type: Sequelize.ENUM(...Object.values(SERVICE_AGREEMENT_SOURCES)),
    });
}

export async function down({ context: { queryInterface } }) {
    await queryInterface.removeColumn('service_agreement', 'data_source');
}
