const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const network_queries = sequelize.define('network_queries', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4(),
        },
        query: DataTypes.JSON,
        timestamp: {
            type: DataTypes.INTEGER,
            defaultValue: () => Date.now(),
        },
    }, {});
    network_queries.associate = function (models) {
        // associations can be defined here
    };
    return network_queries;
};
