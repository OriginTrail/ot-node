const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Token extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Token.hasOne(models.User, { as: 'role' });
        }
    }
    Token.init(
        {
            revoked: DataTypes.BOOLEAN,
            userId: {
                type: DataTypes.INTEGER,
                field: 'user_id',
            },
            name: {
                type: DataTypes.STRING,
            },
            expiresAt: {
                type: DataTypes.DATE,
                field: 'expires_at',
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
            modelName: 'Token',
            underscored: true,
        },
    );
    return Token;
};
