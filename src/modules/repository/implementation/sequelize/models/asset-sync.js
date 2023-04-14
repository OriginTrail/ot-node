export default (sequelize, DataTypes) => {
    const assetSync = sequelize.define(
        'asset_sync',
        {
            blockchain_id: {
                allowNull: false,
                type: DataTypes.STRING,
                primaryKey: true,
            },
            asset_storage_contract: {
                allowNull: false,
                type: DataTypes.STRING,
                primaryKey: true,
            },
            token_id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
            },
            state_index: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
            },
            status: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            created_at: {
                allowNull: false,
                type: DataTypes.DATE,
                defaultValue: () => Date.now(),
            },
            updated_at: {
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
