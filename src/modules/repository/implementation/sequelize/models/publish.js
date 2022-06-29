module.exports = (sequelize, DataTypes) => {
    const publish = sequelize.define(
        'publish',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            handler_id: DataTypes.UUID,
            status: DataTypes.STRING,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    publish.associate = (models) => {
        // associations can be defined here
    };
    return publish;
};
