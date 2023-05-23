export default (sequelize, DataTypes) => {
    const event = sequelize.define(
        'event',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operationId: DataTypes.UUID,
            name: DataTypes.STRING,
            timestamp: DataTypes.STRING,
            value1: DataTypes.TEXT,
            value2: DataTypes.TEXT,
            value3: DataTypes.TEXT,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    event.associate = () => {
        // associations can be defined here
    };
    return event;
};
