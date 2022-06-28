const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Ability extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate() {
            // define association here
        }
    }
    Ability.init(
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
            modelName: 'Ability',
            underscored: true,
        },
    );
    return Ability;
};
