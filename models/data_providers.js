
module.exports = (sequelize, DataTypes) => {
    var data_providers = sequelize.define('data_providers', {
        ip: DataTypes.STRING(70),
        description: DataTypes.STRING(200),
    }, {});
    data_providers.associate = function (models) {
    // associations can be defined here
    };
    return data_providers;
};
