
module.exports = (sequelize, DataTypes) => {
    var holding_data = sequelize.define('holding_data', {
        dc_id: DataTypes.INTEGER,
        data_id: DataTypes.INTEGER,
        start_time: DataTypes.DATE,
        end_time: DataTypes.DATE,
        total_token_amount: DataTypes.REAL,
        data_size: DataTypes.REAL,
        my_stake: DataTypes.REAL,
        dc_stake: DataTypes.REAL,
    }, {
        tableName: 'holding_data',
    });
    holding_data.associate = function (models) {
    // associations can be defined here
    };
    return holding_data;
};
