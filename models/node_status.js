const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const node_status = sequelize.define('node_status', {
        hostname: DataTypes.STRING,
        status: DataTypes.STRING,
        timestamp: DataTypes.DATE,
    }, {
        tableName: 'node_status',
    });
    node_status.associate = (models) => {
    // associations can be defined here
    };
    return node_status;
};

