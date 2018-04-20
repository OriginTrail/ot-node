
module.exports = (sequelize, DataTypes) => {
    const offers = sequelize.define('offers', {
        id: DataTypes.STRING(256),
        data_lifespan: DataTypes.INTEGER,
        max_tender_time: DataTypes.INTEGER,
        min_number_of_applicants: DataTypes.INTEGER,
        price_in_tokens: DataTypes.REAL,
        data_size_in_bytes: DataTypes.INTEGER,
        root_hash: DataTypes.STRING(256),
    }, {
        tableName: 'offers',
    });
    offers.associate = function (models) {
    // associations can be defined here
    };
    return offers;
};
