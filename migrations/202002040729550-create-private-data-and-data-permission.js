module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('private_data', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.STRING,
            },
            data_set_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            element_id: {
                allowNull: false,
                type: Sequelize.STRING,
            },
        });

        await queryInterface.createTable('data_permission', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.STRING,
            },
            id_private_data: {
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
        await queryInterface.dropTable('private_data');
        await queryInterface.dropTable('data_permission');
    },
};
