
module.exports = (sequelize, DataTypes) => {
    const network_queries = sequelize.define('network_queries', {
        query: DataTypes.STRING,
        timestamp: DataTypes.INTEGER,
    }, {});
    network_queries.associate = function (models) {
        // associations can be defined here
    };
    return network_queries;
};
