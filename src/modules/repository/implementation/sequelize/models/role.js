export default (sequelize, DataTypes) => {
    const role = sequelize.define(
        'role',
        {
            name: DataTypes.STRING,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    role.associate = (models) => {
        role.belongsToMany(models.ability, {
            as: 'abilities',
            foreignKey: 'ability_id',
            through: models.role_ability,
        });
    };
    return role;
};
