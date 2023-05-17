export default (sequelize, DataTypes) => {
    const user = sequelize.define(
        'user',
        {
            name: {
                type: DataTypes.STRING,
                unique: true,
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    user.associate = (models) => {
        user.hasMany(models.token, { as: 'tokens' });
        user.hasOne(models.role, { as: 'role' });
    };
    return user;
};
