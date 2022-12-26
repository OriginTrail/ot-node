export default (sequelize, DataTypes) => {
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
            value1: DataTypes.TEXT,
            value2: DataTypes.TEXT,
            value3: DataTypes.TEXT,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    event.associate = () => {
        // associations can be defined here
    };
    return event;
};
