const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const public_keys = sequelize.define('public_keys', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: () => uuidv4(),
        },
        public_key: DataTypes.TEXT,
        node_erc: DataTypes.STRING,
        node_id: DataTypes.STRING,
        timestamp: {
            type: DataTypes.BIGINT,
            defaultValue: () => Date.now(),
        },
    }, {});
    public_keys.associate = (models) => {
        // associations can be defined here
    };
    return public_keys;
};
