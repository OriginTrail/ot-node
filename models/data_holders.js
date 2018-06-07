
module.exports = (sequelize, DataTypes) => {
    var data_holders = sequelize.define('data_holders', {
        import_id: DataTypes.STRING,
        dh_wallet: DataTypes.STRING,
        dh_kademlia_id: DataTypes.STRING,
        m1: DataTypes.STRING,
        m2: DataTypes.STRING,
        e: DataTypes.STRING,
        sd: DataTypes.STRING,
        r1: DataTypes.STRING,
        r2: DataTypes.STRING,
    }, {});
    data_holders.associate = function (models) {
    // associations can be defined here
    };
    return data_holders;
};
