module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('jobs', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.STRING,
            },
            publisher: {
                type: Sequelize.STRING,
            },
            assertion_hash: {
                type: Sequelize.STRING,
            },
            tx_hash: {
                type: Sequelize.STRING,
            },
            signature: {
                type: Sequelize.TEXT,
            },
            blockchain_id: {
                type: Sequelize.STRING,
            },
            published_to: {
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
        await queryInterface.dropTable('jobs');
    },
};
