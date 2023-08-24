export default (sequelize, DataTypes) => {
    const assetSync = sequelize.define(
        'asset_sync',
        {
            blockchainId: {
                allowNull: false,
                type: DataTypes.STRING,
                primaryKey: true,
            },
            assetStorageContract: {
                allowNull: false,
                type: DataTypes.STRING,
                primaryKey: true,
            },
            tokenId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
            },
            stateIndex: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
            },
            status: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            insertedByCommand: {
                allowNull: false,
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
            createdAt: {
                allowNull: false,
                type: DataTypes.DATE,
                defaultValue: () => Date.now(),
            },
            updatedAt: {
                allowNull: false,
                type: DataTypes.DATE,
                defaultValue: () => Date.now(),
            },
        },
        { underscored: true },
    );
    assetSync.associate = () => {
        // define association here
    };
    return assetSync;
};
