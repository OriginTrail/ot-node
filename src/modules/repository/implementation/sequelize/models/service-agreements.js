export default (sequelize, DataTypes) => {
    const serviceAgreements = sequelize.define(
        'service_agreements',
        {
            blockchain_id: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            asset_storage_contract_address: {
                type: DataTypes.STRING(42),
                primaryKey: true,
            },
            token_id: {
                type: DataTypes.INTEGER.UNSIGNED,
                primaryKey: true,
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
            proof_window_offset_perc: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
            },
        },
        {},
    );
    serviceAgreements.associate = () => {
        // associations can be defined here
    };
    return serviceAgreements;
};
