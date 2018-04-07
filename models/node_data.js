
module.exports = (sequelize, DataTypes) => {
    var node_data = sequelize.define('node_data', {
        key: DataTypes.STRING,
        value: DataTypes.STRING,
    }, {
        tableName: 'node_data',
    });
    node_data.associate = function (models) {
    // associations can be defined here
    };
    return node_data;
};
