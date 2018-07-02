const uuidv4 = require('uuid/v4');

module.exports = (sequelize, DataTypes) => {
    const offers = sequelize.define('offers', {
        import_id: DataTypes.INTEGER,
        total_escrow_time: DataTypes.INTEGER,
        max_token_amount: DataTypes.STRING,
        min_stake_amount: DataTypes.STRING,
        min_reputation: DataTypes.INTEGER,
        data_hash: DataTypes.STRING,
        data_size_bytes: DataTypes.STRING,
        dh_wallets: DataTypes.JSON,
        dh_ids: DataTypes.JSON,
        start_tender_time: DataTypes.INTEGER,
        status: DataTypes.STRING,
        message: DataTypes.STRING,
        external_id: {
            type: DataTypes.STRING,
            defaultValue: () => uuidv4(),
        },
    }, {});
    offers.associate = (models) => {
    // associations can be defined here
    };
    return offers;
};
