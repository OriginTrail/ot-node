module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('commands', {
            id: {
                allowNull: false,
                primaryKey: true,
                type: Sequelize.STRING,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            data: {
                type: Sequelize.JSON,
                allowNull: false,
            },
            sequence: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            ready_at: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            delay: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            started_at: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            deadline_at: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            period: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            status: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message: {
                type: Sequelize.TEXT('long'),
                allowNull: true,
            },
            parent_id: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            retries: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            transactional: {
                type: Sequelize.INTEGER,
                allowNull: false,
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
        await queryInterface.dropTable('commands');
    },
};
