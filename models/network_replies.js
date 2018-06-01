
module.exports = (sequelize, DataTypes) => {
    const network_replies = sequelize.define('network_replies', {
        query: DataTypes.STRING,
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
