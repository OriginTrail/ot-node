
module.exports = (sequelize, DataTypes) => {
    var offers = sequelize.define('offers', {
        total_escrow_time: DataTypes.INTEGER,
        max_token_amount: DataTypes.STRING,
        min_stake_amount: DataTypes.STRING,
        min_reputation: DataTypes.INTEGER,
        data_hash: DataTypes.STRING,
        data_size_bytes: DataTypes.STRING,
        dh_wallets: DataTypes.STRING,
        dh_ids: DataTypes.STRING,
        start_tender_time: DataTypes.INTEGER,

    }, {});
    offers.associate = function (models) {
    // associations can be defined here
    };
    return offers;
};
