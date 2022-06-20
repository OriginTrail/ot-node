module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('publish', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            status: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            nodes_found: {
                allowNull: true,
                type: Sequelize.INTEGER,
            },
            created_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()'),
            },
            updated_at: {
                allowNull: false,
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()'),
            },
        });
    },
    down: async (queryInterface) => {
        await queryInterface.dropTable('publish');
    },
};
