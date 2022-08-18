module.exports = (sequelize, DataTypes) => {
    const get_response = sequelize.define(
        'get_response',
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
    get_response.associate = () => {
        // associations can be defined here
    };
    return get_response;
};
