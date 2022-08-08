module.exports = (sequelize, DataTypes) => {
    const search_response = sequelize.define(
        'search_response',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operation_id: DataTypes.UUID,
            keyword: DataTypes.STRING,
            status: DataTypes.STRING,
            message: DataTypes.TEXT,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    search_response.associate = (models) => {
        // associations can be defined here
    };
    return search_response;
};
