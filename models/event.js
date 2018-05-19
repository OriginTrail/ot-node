
module.exports = (sequelize, DataTypes) => {
    var Event = sequelize.define('events', {
        event: DataTypes.STRING,
        data: DataTypes.TEXT,
        offer_hash: DataTypes.STRING,
        block: DataTypes.INTEGER,
        finished: DataTypes.BOOLEAN,
        timestamp: DataTypes.INTEGER,
    }, {});
    Event.associate = function (models) {
    // associations can be defined here
    };
    return Event;
};
