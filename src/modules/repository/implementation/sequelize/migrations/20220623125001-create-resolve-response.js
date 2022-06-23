module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('resolve_response', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            resolve_id: {
                type: Sequelize.INTEGER,
                references: { model: 'resolve', key: 'id' }
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
        await queryInterface.dropTable('resolve_response');
    },
};
