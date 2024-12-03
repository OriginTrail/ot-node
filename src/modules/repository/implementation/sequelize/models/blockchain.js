export default (sequelize, DataTypes) => {
    const blockchain = sequelize.define(
        'blockchain',
        {
            blockchain: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            contract: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            lastCheckedBlock: DataTypes.BIGINT,
            lastCheckedTimestamp: DataTypes.BIGINT,
        },
        { underscored: true },
    );
    blockchain.associate = () => {
        // associations can be defined here
    };
    return blockchain;
};
