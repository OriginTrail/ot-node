
module.exports = (sequelize, DataTypes) => {
    var node_config = sequelize.define('node_config', {
        key: DataTypes.STRING,
        value: DataTypes.STRING,
    }, {
        tableName: 'node_config',
    });
    node_config.associate = function (models) {
    // associations can be defined here
    };
    return node_config;
};
