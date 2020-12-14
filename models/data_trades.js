const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const data_trades = sequelize.define('data_trades', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        data_set_id: DataTypes.STRING,
        blockchain_id: DataTypes.STRING,
        ot_json_object_id: DataTypes.STRING,
        buyer_node_id: DataTypes.STRING,
        buyer_erc_id: DataTypes.STRING,
        seller_node_id: DataTypes.STRING,
        seller_erc_id: DataTypes.STRING,
        price: DataTypes.STRING,
        purchase_id: DataTypes.STRING,
        timestamp: {
            type: DataTypes.INTEGER,
            defaultValue: () => Date.now(),
        },
        status: DataTypes.STRING,
    }, {});
    data_trades.associate = function (models) {
    // associations can be defined here
    };
    return data_trades;
};
