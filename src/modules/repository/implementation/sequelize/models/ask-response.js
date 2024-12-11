export default (sequelize, DataTypes) => {
    const askResponse = sequelize.define(
        'ask_response',
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
    askResponse.associate = () => {
        // associations can be defined here
    };
    return askResponse;
};
