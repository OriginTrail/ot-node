module.exports = (sequelize, DataTypes) => {
    const query = sequelize.define(
        'query',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operation_id: DataTypes.UUID,
            status: DataTypes.STRING,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    query.associate = (models) => {
        // associations can be defined here
    };
    return query;
};
