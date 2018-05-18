
module.exports = (sequelize, DataTypes) => {
    var Event = sequelize.define('events', {
        event: DataTypes.STRING,
        data: DataTypes.TEXT,
        dataId: DataTypes.INTEGER,
        block: DataTypes.INTEGER,
        finished: DataTypes.BOOLEAN,
    }, {});
    Event.associate = function (models) {
    // associations can be defined here
    };
    return Event;
};
