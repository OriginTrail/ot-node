
module.exports = (sequelize, DataTypes) => {
    var data_info = sequelize.define('data_info', {
        import_id: DataTypes.STRING,
        data_provider_wallet: DataTypes.STRING(42),
        total_documents: DataTypes.INTEGER,
        root_hash: DataTypes.STRING(40),
        import_timestamp: DataTypes.DATE,
        data_size: DataTypes.INTEGER,
    }, {
        tableName: 'data_info',
    });
    data_info.associate = function (models) {
    // associations can be defined here
    };
    return data_info;
};
