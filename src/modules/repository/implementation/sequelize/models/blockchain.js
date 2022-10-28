export default (sequelize, DataTypes) => {
    const blockchain = sequelize.define(
        'blockchain',
        {
            blockchain_id: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            last_checked_block: DataTypes.BIGINT,
            last_checked_timestamp: DataTypes.BIGINT,
        },
        { underscored: true },
    );
    blockchain.associate = () => {
        // associations can be defined here
    };
    return blockchain;
};
