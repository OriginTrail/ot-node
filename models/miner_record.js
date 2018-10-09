const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const miner = sequelize.define('miner_records', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        offer_id: DataTypes.STRING,
        difficulty: DataTypes.INTEGER,
        task: DataTypes.STRING,
        result: DataTypes.JSON,
        status: DataTypes.STRING,
        message: DataTypes.STRING,
    }, {});
    miner.associate = (models) => {
        // associations can be defined here
    };
    return miner;
};
