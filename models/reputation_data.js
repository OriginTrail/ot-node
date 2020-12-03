const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const reputation_data = sequelize.define('reputation_data', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        dh_identity: DataTypes.STRING,
        offer_id: DataTypes.STRING,
        reputation_delta: DataTypes.STRING,
        timestamp: DataTypes.BIGINT,
    }, {
        tableName: 'reputation_data',
    });
    reputation_data.associate = (models) => {
        // associations can be defined here
    };
    return reputation_data;
};
