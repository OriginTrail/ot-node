export default (sequelize, DataTypes) => {
    const getResponse = sequelize.define(
        'get_response',
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
    getResponse.associate = () => {
        // associations can be defined here
    };
    return getResponse;
};
