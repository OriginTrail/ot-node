
module.exports = (sequelize, DataTypes) => {
    const replicated_data = sequelize.define('replicated_data', {
        dh_id: DataTypes.STRING,
        dh_wallet: DataTypes.STRING,
        dh_identity: DataTypes.STRING,
        offer_id: DataTypes.STRING,
        color: DataTypes.STRING,
        litigation_private_key: DataTypes.TEXT,
        litigation_public_key: DataTypes.TEXT,
        distribution_public_key: DataTypes.TEXT,
        distribution_private_key: DataTypes.TEXT,
        litigation_root_hash: DataTypes.STRING,
        distribution_root_hash: DataTypes.STRING,
        distribution_epk: DataTypes.TEXT,
        confirmation: DataTypes.STRING,
        status: DataTypes.STRING,
        last_litigation_timestamp: DataTypes.DATE,
    }, {});
    replicated_data.associate = (models) => {
        // associations can be defined here
    };
    return replicated_data;
};
