module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.createTable('operation_ids', {
            operation_id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.STRING,
            },
            data: {
                allowNull: true,
                type: Sequelize.TEXT,
            },
            status: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            timestamp: {
                type: Sequelize.BIGINT,
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
        }),
    down: async (queryInterface) => queryInterface.dropTable('operation_ids'),
};
