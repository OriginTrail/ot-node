const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const data_sellers = sequelize.define('data_sellers', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        data_set_id: DataTypes.STRING,
        blockchain_id: DataTypes.STRING,
        ot_json_object_id: DataTypes.STRING,
        seller_node_id: DataTypes.STRING,
        seller_erc_id: DataTypes.STRING,
        price: DataTypes.STRING,
    }, {});
    data_sellers.associate = function (models) {
    // associations can be defined here
    };
    return data_sellers;
};
