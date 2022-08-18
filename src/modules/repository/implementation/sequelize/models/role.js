const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Role extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Role.belongsToMany(models.Ability, {
                as: 'abilities',
                foreignKey: 'ability_id',
                through: models.RoleAbility,
            });
        }
    }
    Role.init(
        {
            name: DataTypes.STRING,
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
            modelName: 'Role',
            underscored: true,
        },
    );
    return Role;
};
