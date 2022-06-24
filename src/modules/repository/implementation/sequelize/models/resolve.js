module.exports = (sequelize, DataTypes) => {
    const resolve = sequelize.define(
        'resolve',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            status: DataTypes.STRING,
            assertion_id: DataTypes.STRING,
            nodes_found: DataTypes.INTEGER,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    resolve.associate = (models) => {
        resolve.hasMany(models.resolve_response, { foreignKey: 'resolve_id' });
    };
    return resolve;
};
