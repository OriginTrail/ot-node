const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const private_data_permissions = sequelize.define('private_data_permissions', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        data_set_id: DataTypes.STRING,
        ot_json_object_id: DataTypes.STRING,
        buyer_node_id: DataTypes.STRING,
        buyer_erc_id: DataTypes.STRING,
        seller_node_id: DataTypes.STRING,
        seller_erc_id: DataTypes.STRING,
        price: DataTypes.STRING,
        purchase_id: DataTypes.STRING,
    }, {});
    private_data_permissions.associate = function (models) {
    // associations can be defined here
    };
    return private_data_permissions;
};
