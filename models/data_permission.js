const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const data_permission = sequelize.define('data_permission', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        id_private_data: DataTypes.STRING,
        node_id: DataTypes.STRING,
    }, {});
    data_permission.associate = function (models) {
    // associations can be defined here
    };
    return data_permission;
};
