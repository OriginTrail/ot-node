export default (sequelize, DataTypes) => {
    const blockchain = sequelize.define(
        'paranet_synced_asset',
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
                allowNull: false,
                type: DataTypes.STRING,
            },
            sender: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            transactionHash: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            createdAt: {
                type: DataTypes.DATE,
            },
            updatedAt: {
                type: DataTypes.DATE,
            },
        },
        { underscored: true },
    );
    blockchain.associate = () => {
        // associations can be defined here
    };
    return blockchain;
};
