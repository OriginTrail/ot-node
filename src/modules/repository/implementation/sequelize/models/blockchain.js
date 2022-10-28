export default (sequelize, DataTypes) => {
    const blockchain = sequelize.define(
        'blockchain',
        {
            blockchain_id: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            last_checked_block: DataTypes.INTEGER,
            last_checked_timestamp: DataTypes.INTEGER,
        },
        { underscored: true },
    );
    blockchain.associate = () => {
        // associations can be defined here
    };
    return blockchain;
};
