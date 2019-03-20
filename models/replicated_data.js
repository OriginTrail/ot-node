
module.exports = (sequelize, DataTypes) => {
    const replicated_data = sequelize.define('replicated_data', {
        dh_id: DataTypes.STRING,
        dh_wallet: DataTypes.STRING,
        dh_identity: DataTypes.STRING,
        offer_id: DataTypes.STRING,
        color: DataTypes.STRING,
        litigation_private_key: DataTypes.STRING,
        litigation_public_key: DataTypes.STRING,
        distribution_public_key: DataTypes.STRING,
        distribution_private_key: DataTypes.STRING,
        litigation_root_hash: DataTypes.STRING,
        distribution_root_hash: DataTypes.STRING,
        distribution_epk: DataTypes.STRING,
        confirmation: DataTypes.STRING,
        status: DataTypes.STRING,
    }, {});
    replicated_data.associate = (models) => {
        // associations can be defined here
    };
    return replicated_data;
};
