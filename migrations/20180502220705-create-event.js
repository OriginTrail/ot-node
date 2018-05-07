
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
            type: Sequelize.INTEGER,
        },

        dataId: {
            type: Sequelize.INTEGER,
        },
        finished: {
            type: Sequelize.STRING,
        },
        createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
        },
        updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
        },
    }),
    down: (queryInterface, Sequelize) => queryInterface.dropTable('Events'),
};
