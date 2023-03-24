export default (sequelize, DataTypes) => {
    const update_response = sequelize.define(
        'update_response',
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
    update_response.associate = () => {
        // associations can be defined here
    };
    return update_response;
};
