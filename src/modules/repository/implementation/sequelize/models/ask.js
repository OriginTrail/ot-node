export default (sequelize, DataTypes) => {
    const ask = sequelize.define(
        'ask',
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
    ask.associate = () => {
        // associations can be defined here
    };
    return ask;
};
