module.exports = (sequelize, DataTypes) => {
    const resolve_response = sequelize.define('resolve_response', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        handler_id: DataTypes.UUID,
        status: DataTypes.STRING,
        message: DataTypes.TEXT,
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    }, {});
    resolve_response.associate = (models) => {
        // associations can be defined here
    };
    return resolve_response;
};
