export default (sequelize, DataTypes) => {
    const update = sequelize.define(
        'update',
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
    update.associate = () => {
        // associations can be defined here
    };
    return update;
};
