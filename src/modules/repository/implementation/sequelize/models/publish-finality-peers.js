export default (sequelize, DataTypes) => {
    const publishFinality = sequelize.define(
        'publish_finality_peers',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            ual: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            peerId: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    publishFinality.associate = () => {
        // associations can be defined here
    };
    return publishFinality;
};
