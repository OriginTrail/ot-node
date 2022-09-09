module.exports = (sequelize, DataTypes) => {
    const get = sequelize.define(
        'get',
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
    get.associate = () => {
        // associations can be defined here
    };
    return get;
};
