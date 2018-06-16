
module.exports = (sequelize, DataTypes) => {
    const bids = sequelize.define('bids', {
        bid_index: DataTypes.INTEGER,
        price: DataTypes.STRING,
        import_id: DataTypes.STRING,
        dc_wallet: DataTypes.STRING,
        dc_id: DataTypes.STRING,
        total_escrow_time: DataTypes.INTEGER,
        stake: DataTypes.STRING,
        data_size_bytes: DataTypes.STRING,
    }, {});
    bids.associate = function (models) {
    // associations can be defined here
    };
    return bids;
};
