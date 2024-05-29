export default (sequelize, DataTypes) => {
    const blockchain = sequelize.define(
        'missed_paranet_asset',
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
        },
        { underscored: true },
    );
    blockchain.associate = () => {
        // associations can be defined here
    };
    return blockchain;
};
