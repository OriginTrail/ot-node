export default (sequelize, DataTypes) => {
    const ability = sequelize.define(
        'ability',
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
                defaultValue: DataTypes.literal('NOW()'),
            },
            updated_at: {
                allowNull: false,
                type: DataTypes.DATE,
                defaultValue: DataTypes.literal('NOW()'),
            },
        },
        { underscored: true },
    );
    ability.associate = () => {
        // define association here
    };
    return ability;
};
