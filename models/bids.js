
module.exports = (sequelize, DataTypes) => {
    const bids = sequelize.define('bids', {
        bid_index: DataTypes.INTEGER,
        price: DataTypes.INTEGER,
        hash: DataTypes.STRING(128),
        data_id: DataTypes.INTEGER,
        dc_wallet: DataTypes.STRING,
        dc_id: DataTypes.STRING,
        total_escrow_time: DataTypes.INTEGER,
        stake: DataTypes.INTEGER,
        data_size_bytes: DataTypes.INTEGER,
    }, {});
    bids.associate = function (models) {
    // associations can be defined here
    };
    return bids;
};
