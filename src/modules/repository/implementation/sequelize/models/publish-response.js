export default (sequelize, DataTypes) => {
    const publishResponse = sequelize.define(
        'publish_response',
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
    publishResponse.associate = () => {
        // associations can be defined here
    };
    return publishResponse;
};
