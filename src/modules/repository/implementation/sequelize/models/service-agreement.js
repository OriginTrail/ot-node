export default (sequelize, DataTypes) => {
    const serviceAgreement = sequelize.define(
        'service_agreement',
        {
            blockchainId: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            assetStorageContractAddress: {
                type: DataTypes.STRING(42),
                allowNull: false,
            },
            tokenId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            agreementId: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            startTime: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            epochsNumber: {
                type: DataTypes.SMALLINT.UNSIGNED,
                allowNull: false,
            },
            epochLength: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            scoreFunctionId: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
            },
            stateIndex: {
                type: DataTypes.SMALLINT.UNSIGNED,
                allowNull: false,
            },
            assertionId: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            hashFunctionId: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
            },
            keyword: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            proofWindowOffsetPerc: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
            },
            lastCommitEpoch: {
                type: DataTypes.SMALLINT.UNSIGNED,
            },
            lastProofEpoch: {
                type: DataTypes.SMALLINT.UNSIGNED,
            },
        },
        { underscored: true },
    );
    serviceAgreement.associate = () => {
        // associations can be defined here
    };
    return serviceAgreement;
};
