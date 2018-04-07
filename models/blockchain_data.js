
module.exports = (sequelize, DataTypes) => {
    var blockchain_data = sequelize.define('blockchain_data', {
        blockchain_title: DataTypes.STRING,
        network_id: DataTypes.STRING,
        gas_limit: DataTypes.INTEGER,
        gas_price: DataTypes.INTEGER,
    }, {});
    blockchain_data.associate = function (models) {
    // associations can be defined here
    };
    return blockchain_data;
};
