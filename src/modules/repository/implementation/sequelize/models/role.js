export default (sequelize, DataTypes) => {
    const role = sequelize.define(
        'role',
        {
            name: DataTypes.STRING,
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
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
