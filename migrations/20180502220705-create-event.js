
module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.createTable('events', {
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
        },
        event: {
            type: Sequelize.STRING,
        },
        data: {
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
