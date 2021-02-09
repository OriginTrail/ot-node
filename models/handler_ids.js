const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const handler_ids = sequelize.define('handler_ids', {
        handler_id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4(),
        },
        data: DataTypes.TEXT,
        status: DataTypes.STRING,
        timestamp: {
            type: DataTypes.BIGINT,
            defaultValue: () => Date.now(),
        },
    }, {});
    handler_ids.associate = (models) => {
        // associations can be defined here
    };
    return handler_ids;
};
