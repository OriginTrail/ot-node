import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
    class User extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            User.hasMany(models.Token, { as: 'tokens' });
            User.hasOne(models.Role, { as: 'role' });
        }
    }
    User.init(
        {
            name: {
                type: DataTypes.STRING,
                unique: true,
            },
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
            modelName: 'User',
            underscored: true,
        },
    );
    return User;
};
