
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('blockchain_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        blockchain_title: {
            type: Sequelize.STRING,
        },
        network_id: {
            type: Sequelize.STRING,
        },
        gas_limit: {
            type: Sequelize.INTEGER,
        },
        gas_price: {
            type: Sequelize.INTEGER,
        },
        ot_contract_address: {
            type: Sequelize.STRING,
        },
        token_contract_address: {
            type: Sequelize.STRING,
        },
        escrow_contract_address: {
            type: Sequelize.STRING,
        },
        rpc_node_host: {
            type: Sequelize.STRING,
        },
        rpc_node_port: {
            type: Sequelize.INTEGER,
        },
        wallet_address: {
            type: Sequelize.STRING,
        },
        wallet_private_key: {
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('blockchain_data'),
};
