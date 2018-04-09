
module.exports = (sequelize, DataTypes) => {
    var data_creators = sequelize.define('data_creators', {
        dc_wallet: DataTypes.STRING(50),
        dc_kademlia_id: DataTypes.STRING(128),
        public_key: DataTypes.STRING(2048),
    }, {});
    data_creators.associate = function (models) {
    // associations can be defined here
    };
    return data_creators;
};
