const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const offers = sequelize.define('offers', {
        id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
            primaryKey: true,
        },
        offer_id: DataTypes.STRING,
        data_set_id: DataTypes.STRING,
        holding_time_in_minutes: DataTypes.INTEGER,
        token_amount_per_holder: DataTypes.STRING,
        litigation_interval_in_minutes: DataTypes.INTEGER,
        red_litigation_hash: DataTypes.STRING,
        blue_litigation_hash: DataTypes.STRING,
        green_litigation_hash: DataTypes.STRING,
        task: DataTypes.STRING,
        status: DataTypes.STRING,
        global_status: DataTypes.STRING,
        message: DataTypes.STRING,
        transaction_hash: DataTypes.STRING(128),
    }, {});
    offers.associate = (models) => {
    // associations can be defined here
    };
    return offers;
};
