
module.exports = (sequelize, DataTypes) => {
    var data_holders = sequelize.define('data_holders', {
        dh_wallet: DataTypes.STRING(50),
        dh_kademlia_id: DataTypes.STRING(128),
        data_public_key: DataTypes.STRING(2048),
        data_private_key: DataTypes.STRING(2048),
    }, {});
    data_holders.associate = function (models) {
    // associations can be defined here
    };
    return data_holders;
};
