export default (sequelize, DataTypes) => {
    const finalityResponse = sequelize.define(
        'finality_response',
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
    finalityResponse.associate = () => {
        // associations can be defined here
    };
    return finalityResponse;
};
