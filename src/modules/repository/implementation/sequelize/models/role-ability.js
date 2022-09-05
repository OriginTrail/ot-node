import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
    class RoleAbility extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            RoleAbility.hasOne(models.Ability, { as: 'ability' });
            RoleAbility.hasOne(models.Role, { as: 'role' });
        }
    }

    RoleAbility.init(
        {
            createdAt: {
                type: DataTypes.DATE,
                field: 'created_at',
            },
            updatedAt: {
                type: DataTypes.DATE,
                field: 'updated_at',
            },
        },
        {
            sequelize,
            modelName: 'RoleAbility',
            underscored: true,
        },
    );
    return RoleAbility;
};
