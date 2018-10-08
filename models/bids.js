const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const bids = sequelize.define('bids', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        offer_id: DataTypes.STRING,
        dc_wallet: DataTypes.STRING,
        dc_node_id: DataTypes.STRING,
    }, {});
    bids.associate = (models) => {
        // associations can be defined here
    };
    return bids;
};
