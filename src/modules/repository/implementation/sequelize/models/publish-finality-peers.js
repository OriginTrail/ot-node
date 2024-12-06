export default (sequelize, DataTypes) => {
    const publishFinality = sequelize.define(
        'publish_finality_peers',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.STRING,
            ual: DataTypes.STRING,
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
