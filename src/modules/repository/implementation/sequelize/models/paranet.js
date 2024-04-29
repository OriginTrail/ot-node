'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Paranet extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  Paranet.init({
    name: DataTypes.STRING,
    description: DataTypes.STRING,
    paranetId: DataTypes.STRING,
    kaCount: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Paranet',
  });
  return Paranet;
};