
module.exports = (sequelize, DataTypes) => {
    const holding_data = sequelize.define('holding_data', {
        data_set_id: DataTypes.STRING,
        source_wallet: DataTypes.STRING,
        litigation_public_key: DataTypes.STRING,
        litigation_root_hash: DataTypes.STRING,
        distribution_public_key: DataTypes.STRING,
        distribution_private_key: DataTypes.STRING,
        distribution_epk: DataTypes.STRING,
        transaction_hash: DataTypes.STRING(128),
        color: DataTypes.INTEGER,
    }, {
        tableName: 'holding_data',
    });
    holding_data.associate = (models) => {
    // associations can be defined here
    };
    return holding_data;
};
