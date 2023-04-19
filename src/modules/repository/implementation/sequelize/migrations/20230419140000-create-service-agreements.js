export const up = async ({ context: { queryInterface, Sequelize } }) => {
    await queryInterface.createTable('service_agreements', {
        blockchain_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        asset_storage_contract_address: {
            type: Sequelize.STRING(42),
            primaryKey: true,
        },
        token_id: {
            type: Sequelize.INTEGER.UNSIGNED,
            primaryKey: true,
        },
        agreement_id: {
            type: Sequelize.STRING,
            primaryKey: true,
        },
        start_time: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
        },
        epochs_number: {
            type: Sequelize.SMALLINT.UNSIGNED,
            allowNull: false,
        },
        epoch_length: {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
        },
        score_function_id: {
            type: Sequelize.TINYINT.UNSIGNED,
            allowNull: false,
        },
        proof_window_offset_perc: {
            type: Sequelize.TINYINT.UNSIGNED,
            allowNull: false,
        },
    });
};

export const down = async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('service_agreements');
};
