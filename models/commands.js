const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const offers = sequelize.define('commands', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4(),
        },
        name: DataTypes.STRING,
        data: DataTypes.JSON,
        sequence: DataTypes.JSON,
        ready_at: DataTypes.BIGINT,
        delay: DataTypes.INTEGER,
        started_at: DataTypes.BIGINT,
        deadline_at: DataTypes.BIGINT,
        period: DataTypes.INTEGER,
        status: DataTypes.STRING,
        message: DataTypes.STRING,
        parent_id: DataTypes.UUID,
        transactional: DataTypes.INTEGER,
        retries: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
    }, {});
    offers.associate = (models) => {
        // associations can be defined here
    };
    return offers;
};
