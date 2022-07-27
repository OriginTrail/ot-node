module.exports = (sequelize, DataTypes) => {
    const event = sequelize.define(
        'event',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operation_id: DataTypes.UUID,
            name: DataTypes.STRING,
            timestamp: DataTypes.STRING,
            value1: DataTypes.STRING,
            value2: DataTypes.STRING,
            value3: DataTypes.STRING,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    event.associate = (models) => {
        // associations can be defined here
    };
    return event;
};
