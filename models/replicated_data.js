
module.exports = (sequelize, DataTypes) => {
    const replicated_data = sequelize.define('replicated_data', {
        dh_id: DataTypes.STRING,
        dh_wallet: DataTypes.STRING,
        offer_id: DataTypes.STRING,
        color: DataTypes.STRING,
    }, {});
    replicated_data.associate = (models) => {
        // associations can be defined here
    };
    return replicated_data;
};
