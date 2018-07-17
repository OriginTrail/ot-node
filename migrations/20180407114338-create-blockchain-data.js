
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('blockchain_data', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        blockchain_title: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        network_id: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        gas_limit: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        gas_price: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        ot_contract_address: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        token_contract_address: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        escrow_contract_address: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        bidding_contract_address: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        reading_contract_address: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        hub_contract_address: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        rpc_node_host: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        rpc_node_port: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        wallet_address: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        wallet_private_key: {
            allowNull: false,
            type: Sequelize.STRING,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('blockchain_data'),
};
