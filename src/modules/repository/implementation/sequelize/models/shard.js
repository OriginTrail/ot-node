export default (sequelize, DataTypes) => {
    const shard = sequelize.define(
        'shard',
        {
            peer_id: {
                type: DataTypes.STRING,
                primaryKey: true,
            },
            ask: DataTypes.INTEGER,
            stake: DataTypes.INTEGER,
            ip_address: DataTypes.STRING,
            last_seen: DataTypes.DATE,
            public_address: DataTypes.STRING,
        },
        { underscored: true },
    );
    shard.associate = () => {
        // associations can be defined here
    };
    return shard;
};
