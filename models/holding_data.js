
module.exports = (sequelize, DataTypes) => {
    var holding_data = sequelize.define('holding_data', {
        source_wallet: DataTypes.STRING,
        data_public_key: DataTypes.STRING,
        distribution_public_key: DataTypes.STRING,
        distribution_private_key: DataTypes.STRING,
        epk: DataTypes.STRING,
    }, {
        tableName: 'holding_data',
    });
    holding_data.associate = function (models) {
    // associations can be defined here
    };
    return holding_data;
};
