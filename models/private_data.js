const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const private_data = sequelize.define('private_data', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        data_set_id: DataTypes.STRING,
        element_id: DataTypes.STRING,
    }, {});
    private_data.associate = function (models) {
    // associations can be defined here
    };
    return private_data;
};
