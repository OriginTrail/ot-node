module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('assertions', {
            hash: {
                type: Sequelize.STRING,
                primaryKey: true,
                allowNull: false,
            },
            owner: {
                type: Sequelize.STRING,
            },
            signature: {
                type: Sequelize.TEXT,
            },
            topics: {
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
    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable('assertions');
    },
};
