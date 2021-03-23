
module.exports = (sequelize, DataTypes) => {
    var data_provider_wallets = sequelize.define('data_provider_wallets', {
        data_info_id: DataTypes.INTEGER,
        blockchain_id: DataTypes.STRING,
        wallet: DataTypes.STRING,
    }, {
        tableName: 'data_provider_wallets',
    });
    data_provider_wallets.associate = function (models) {
    // associations can be defined here
    };
    return data_provider_wallets;
};
