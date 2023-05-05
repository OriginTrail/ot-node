export default (sequelize, DataTypes) => {
    const shard = sequelize.define(
        'shard',
        {
            peer_id: { type: DataTypes.STRING, primaryKey: true },
            blockchain_id: { type: DataTypes.STRING, primaryKey: true },
            ask: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            stake: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            last_seen: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: new Date(0),
            },
            last_dialed: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: new Date(0),
            },
            sha256: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        { underscored: true },
    );
    shard.associate = () => {
        // associations can be defined here
    };
    return shard;
};
