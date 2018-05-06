
module.exports = (sequelize, DataTypes) => {
    var Event = sequelize.define('events', {
        event: DataTypes.STRING,
        data: DataTypes.TEXT,
        dataId: DataTypes.INTEGER,
        block: DataTypes.INTEGER,
        finished: DataTypes.STRING,
    }, {});
    Event.associate = function (models) {
    // associations can be defined here
    };
    return Event;
};
