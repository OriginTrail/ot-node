module.exports = (sequelize, DataTypes) => {
    const search = sequelize.define(
        'search',
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
    search.associate = (models) => {
        // associations can be defined here
    };
    return search;
};
