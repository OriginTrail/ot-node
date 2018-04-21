
module.exports = (sequelize, DataTypes) => {
    var offers = sequelize.define('offers', {
        data_lifespan: DataTypes.INTEGER,
        start_tender_time: DataTypes.INTEGER,
        tender_duration: DataTypes.INTEGER,
        min_number_applicants: DataTypes.INTEGER,
        price_tokens: DataTypes.INTEGER,
        data_size_bytes: DataTypes.INTEGER,
        replication_number: DataTypes.INTEGER,
        root_hash: DataTypes.STRING,
    }, {});
    offers.associate = function (models) {
    // associations can be defined here
    };
    return offers;
};
