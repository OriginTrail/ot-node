
module.exports = (sequelize, DataTypes) => {
    var Event = sequelize.define('events', {
        contract: DataTypes.STRING,
        event: DataTypes.STRING,
        data: DataTypes.TEXT,
        data_set_id: DataTypes.STRING,
        block: DataTypes.INTEGER,
        finished: DataTypes.BOOLEAN,
        timestamp: DataTypes.INTEGER,
    }, {});
    Event.associate = function (models) {
    // associations can be defined here
    };
    return Event;
};
