module.exports = (sequelize, DataTypes) => {
    const resolve = sequelize.define(
        'resolve',
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
    resolve.associate = (models) => {
        // associations can be defined here
    };
    return resolve;
};
