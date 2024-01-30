export default (sequelize, DataTypes) => {
    const shard = sequelize.define(
        'shard',
        {
            peerId: { type: DataTypes.STRING, primaryKey: true },
            blockchainId: { type: DataTypes.STRING, primaryKey: true },
            ask: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            stake: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            lastSeen: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: new Date(0),
            },
            lastDialed: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: new Date(0),
            },
            sha256: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            sha256Blob: {
                type: DataTypes.BLOB,
            },
        },
        { underscored: true },
    );
    shard.associate = () => {
        // associations can be defined here
    };
    return shard;
};
