module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('private_data_permission', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.STRING,
            },
            data_set_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            data_element_key: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            ot_json_object_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            node_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
        });

    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('private_data_permission');
    },
};
