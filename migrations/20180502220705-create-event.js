
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('events', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        event: {
            allowNull: false,
            type: Sequelize.STRING,
        },
        data: {
            allowNull: false,
            type: Sequelize.TEXT,
        },
        block: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },

        import_id: {
            allowNull: true,
            type: Sequelize.STRING,
        },
        finished: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
        timestamp: {
            allowNull: false,
            type: Sequelize.INTEGER,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('Events'),
};
