module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('search_response', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operation_id: {
                type: Sequelize.UUID,
                allowNull: false,
            },
            keyword: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            status: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            message: {
                allowNull: true,
                type: Sequelize.TEXT,
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
        await queryInterface.dropTable('search_response');
    },
};
