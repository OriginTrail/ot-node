
module.exports = (sequelize, DataTypes) => {
    const purchased_data = sequelize.define('purchased_data', {
        data_set_id: DataTypes.STRING,
        blockchain_id: DataTypes.STRING,
        offer_id: DataTypes.STRING,
        transaction_hash: DataTypes.STRING(128),
    }, {
        tableName: 'purchased_data',
    });
    purchased_data.associate = (models) => {
    // associations can be defined here
    };
    return purchased_data;
};
