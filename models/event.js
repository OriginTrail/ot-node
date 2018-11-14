const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    var Event = sequelize.define('events', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
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
