export default (sequelize, DataTypes) => {
    const paranetAsset = sequelize.define(
        'paranet_asset',
        {
            id: {
                autoIncrement: true,
                primaryKey: true,
                type: DataTypes.INTEGER,
            },
            blockchainId: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            ual: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            paranetUal: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            publicAssertionId: {
                allowNull: true,
                type: DataTypes.STRING,
            },
            privateAssertionId: {
                allowNull: true,
                type: DataTypes.STRING,
            },
            sender: {
                allowNull: true,
                type: DataTypes.STRING,
            },
            transactionHash: {
                allowNull: true,
                type: DataTypes.STRING,
            },
            errorMessage: {
                allowNull: true,
                type: DataTypes.TEXT,
            },
            isSynced: {
                allowNull: false,
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            retries: {
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            createdAt: {
                type: DataTypes.DATE,
            },
            updatedAt: {
                type: DataTypes.DATE,
            },
        },
        {
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ['ual', 'paranetUal'], // Composite unique constraint on `ual` and `paranetUal`
                },
                {
                    fields: ['updatedAt', 'retries', 'isSynced'],
                },
                {
                    fields: ['ual', 'paranetUal'],
                },
                {
                    fields: ['isSynced', 'paranetUal'],
                },
            ],
        },
    );

    paranetAsset.associate = () => {
        // Define associations here if needed
    };

    return paranetAsset;
};
