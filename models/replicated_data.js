
module.exports = (sequelize, DataTypes) => {
    var replicated_data = sequelize.define('replicated_data', {
        dh_id: DataTypes.STRING,
        import_id: DataTypes.STRING,
        offer_id: DataTypes.STRING,
        data_private_key: DataTypes.STRING,
        data_public_key: DataTypes.STRING,
        status: DataTypes.STRING,
    }, {});
    replicated_data.associate = function (models) {
    // associations can be defined here
    };
    return replicated_data;
};
