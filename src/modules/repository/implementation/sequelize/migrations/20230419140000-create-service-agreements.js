export const up = async ({ context: { queryInterface, Sequelize } }) => {
    await queryInterface.createTable('service_agreement', {
        blockchain_id: {
            type: Sequelize.STRING(20),
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
            type: Sequelize.STRING(66),
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
        state_index: {
            type: Sequelize.SMALLINT.UNSIGNED,
            allowNull: false,
        },
        assertion_id: {
            type: Sequelize.STRING(66),
            primaryKey: true,
        },
        hash_function_id: {
            type: Sequelize.TINYINT.UNSIGNED,
            allowNull: false,
        },
        keyword: {
            type: Sequelize.STRING(106),
            primaryKey: true,
        },
        proof_window_offset_perc: {
            type: Sequelize.TINYINT.UNSIGNED,
            allowNull: false,
        },
        last_commit_epoch: {
            type: Sequelize.SMALLINT.UNSIGNED,
        },
        last_proof_epoch: {
            type: Sequelize.SMALLINT.UNSIGNED,
        },
    });
};

export const down = async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('service_agreement');
};
