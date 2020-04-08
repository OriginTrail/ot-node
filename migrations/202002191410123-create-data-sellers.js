module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('data_sellers', {
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
        });
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('data_sellers');
    },
};
