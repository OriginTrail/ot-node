const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Permission extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Permission.hasOne(models.Ability, { as: 'ability' });
            Permission.hasOne(models.Role, { as: 'role' });
        }
    }

    Permission.init(
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
            modelName: 'Permission',
            underscored: true,
        },
    );
    return Permission;
};
