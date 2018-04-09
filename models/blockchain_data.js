
module.exports = (sequelize, DataTypes) => {
    var blockchain_data = sequelize.define('blockchain_data', {
        blockchain_title: DataTypes.STRING(128),
        network_id: DataTypes.STRING(20),
        gas_limit: DataTypes.INTEGER,
        gas_price: DataTypes.INTEGER,
        ot_contract_address: DataTypes.STRING(50),
        token_contract_address: DataTypes.STRING(50),
        escrow_contract_address: DataTypes.STRING(50),
        rpc_node_host: DataTypes.STRING(256),
        rpc_node_port: DataTypes.INTEGER,
        wallet_address: DataTypes.STRING(50),
        wallet_private_key: DataTypes.STRING(100),
    }, {});
    blockchain_data.associate = function (models) {
    // associations can be defined here
    };
    return blockchain_data;
};
