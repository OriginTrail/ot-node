export default (sequelize, DataTypes) => {
    const serviceAgreement = sequelize.define(
        'service_agreement',
        {
            blockchain_id: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            asset_storage_contract_address: {
                type: DataTypes.STRING(42),
                allowNull: false,
            },
            token_id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            agreement_id: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            start_time: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            epochs_number: {
                type: DataTypes.SMALLINT.UNSIGNED,
                allowNull: false,
            },
            epoch_length: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            score_function_id: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
            },
            state_index: {
                type: DataTypes.SMALLINT.UNSIGNED,
                allowNull: false,
            },
            assertion_id: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            hash_function_id: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
            },
            keyword: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            proof_window_offset_perc: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
            },
            last_commit_epoch: {
                type: DataTypes.SMALLINT.UNSIGNED,
            },
            last_proof_epoch: {
                type: DataTypes.SMALLINT.UNSIGNED,
            },
        },
        {},
    );
    serviceAgreement.associate = () => {
        // associations can be defined here
    };
    return serviceAgreement;
};
