export default (sequelize, DataTypes) => {
    const publishParanet = sequelize.define(
        'publish_paranet',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.UUID,
            status: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    publishParanet.associate = () => {
        // associations can be defined here
    };
    return publishParanet;
};
