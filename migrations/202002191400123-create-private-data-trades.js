module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('private_data_trades', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.STRING,
            },
            data_set_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            ot_json_object_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            buyer_node_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            buyer_erc_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            seller_node_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            seller_erc_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            price: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            purchase_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
        });
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('private_data_trades');
    },
};
