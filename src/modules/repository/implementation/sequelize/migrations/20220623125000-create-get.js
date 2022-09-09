module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('get', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            operation_id: {
                type: Sequelize.UUID,
                allowNull: false,
            },
            status: {
                allowNull: false,
                type: Sequelize.STRING,
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
        await queryInterface.dropTable('get');
    },
};
