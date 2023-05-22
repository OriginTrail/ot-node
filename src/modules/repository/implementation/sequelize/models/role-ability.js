export default (sequelize, DataTypes) => {
    const roleAbility = sequelize.define(
        'role_ability',
        {
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        { underscored: true },
    );
    roleAbility.associate = (models) => {
        roleAbility.hasOne(models.ability, { as: 'ability' });
        roleAbility.hasOne(models.role, { as: 'role' });
    };
    return roleAbility;
};
