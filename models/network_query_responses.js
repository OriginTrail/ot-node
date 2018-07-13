
module.exports = (sequelize, DataTypes) => {
    const network_query_responses = sequelize.define('network_query_responses', {
        query_id: DataTypes.UUID,
        wallet: DataTypes.STRING,
        node_id: DataTypes.STRING,
        imports: DataTypes.STRING,
        data_price: DataTypes.STRING,
        stake_factor: DataTypes.STRING,
        reply_id: DataTypes.UUID,
    }, {});
    network_query_responses.associate = function (models) {
        // associations can be defined here
    };
    return network_query_responses;
};
