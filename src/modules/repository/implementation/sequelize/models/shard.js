export default (sequelize, DataTypes) => {
    const shard = sequelize.define(
        'shard',
        {
            peer_id: { type: DataTypes.STRING, primaryKey: true },
            blockchain_id: { type: DataTypes.STRING, primaryKey: true },
            ask: DataTypes.INTEGER,
            stake: DataTypes.INTEGER,
            last_seen: DataTypes.DATE,
            last_dialed: DataTypes.DATE,
            sha256: DataTypes.STRING,
        },
        { underscored: true },
    );
    shard.associate = () => {
        // associations can be defined here
    };
    return shard;
};
