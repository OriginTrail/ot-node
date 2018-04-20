
module.exports = (sequelize, DataTypes) => {
    var offers = sequelize.define('offers', {
        offer_id: DataTypes.STRING,
        data_lifespan: DataTypes.INTEGER,
        start_tender_time: DataTypes.INTEGER,
        tender_duration: DataTypes.INTEGER,
        min_number_applicants: DataTypes.INTEGER,
        price_tokens: DataTypes.REAL,
        data_size_bytes: DataTypes.INTEGER,
        root_hash: DataTypes.STRING,
    }, {});
    offers.associate = function (models) {
    // associations can be defined here
    };
    return offers;
};
