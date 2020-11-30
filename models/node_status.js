const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const node_status = sequelize.define('node_status', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        node_ip: DataTypes.STRING,
        status: DataTypes.STRING,
        timestamp: DataTypes.INTEGER,
    }, {
        tableName: 'node_status',
    });
    node_status.associate = (models) => {
    // associations can be defined here
    };
    return node_status;
};

