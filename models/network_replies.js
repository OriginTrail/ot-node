const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const network_replies = sequelize.define('network_replies', {
        id: {
            type: DataTypes.UUID,
            defaultValue: uuidv4(),
            primaryKey: true,
        },
        data: DataTypes.JSON,
        receiver_wallet: DataTypes.STRING,
        receiver_identity: DataTypes.STRING,
        timestamp: {
            type: DataTypes.INTEGER,
            defaultValue: Date.now(),
        },
    }, {});
    network_replies.associate = function (models) {
        // associations can be defined here
    };
    return network_replies;
};
