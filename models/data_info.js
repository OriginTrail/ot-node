
module.exports = (sequelize, DataTypes) => {
    var data_info = sequelize.define('data_info', {
        data_set_id: DataTypes.STRING,
        total_documents: DataTypes.INTEGER,
        root_hash: DataTypes.STRING(40),
        import_timestamp: DataTypes.DATE,
        origin: DataTypes.STRING,
        otjson_size_in_bytes: DataTypes.INTEGER,
        data_hash: DataTypes.STRING,
    }, {
        tableName: 'data_info',
    });
    data_info.associate = function (models) {
        data_info.hasMany(models.data_provider_wallets, { foreignKey: 'data_info_id' });
    };
    return data_info;
};
