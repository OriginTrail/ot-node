export default (sequelize, DataTypes) => {
    const roleAbility = sequelize.define(
        'role_ability',
        {
            created_at: DataTypes.DATE,
            updated_at: DataTypes.DATE,
        },
        {},
    );
    roleAbility.associate = (models) => {
        roleAbility.hasOne(models.ability, { as: 'ability' });
        roleAbility.hasOne(models.role, { as: 'role' });
    };
    return roleAbility;
};
