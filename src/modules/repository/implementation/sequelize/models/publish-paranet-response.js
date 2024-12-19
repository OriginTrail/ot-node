export default (sequelize, DataTypes) => {
    const publishParanetResponse = sequelize.define(
        'publish_paranet_response',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.UUID,
            status: DataTypes.STRING,
            message: DataTypes.TEXT,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    publishParanetResponse.associate = () => {
        // associations can be defined here
    };
    return publishParanetResponse;
};
