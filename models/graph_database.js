
module.exports = (sequelize, DataTypes) => {
    var graph_database = sequelize.define('graph_database', {
        database_system: DataTypes.STRING(128),
        username: DataTypes.STRING(50),
        password: DataTypes.STRING(50),
        host: DataTypes.STRING(255),
        port: DataTypes.INTEGER,
        max_path_length: DataTypes.INTEGER,
        database: DataTypes.STRING(50),
    }, {
        tableName: 'graph_database',
    });
    graph_database.associate = function (models) {
    // associations can be defined here
    };
    return graph_database;
};
