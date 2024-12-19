export default (sequelize, DataTypes) => {
    const updateResponse = sequelize.define(
        'update_response',
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
    updateResponse.associate = () => {
        // associations can be defined here
    };
    return updateResponse;
};
