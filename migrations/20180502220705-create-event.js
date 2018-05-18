
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

        dataId: {
            type: Sequelize.INTEGER,
        },
        finished: {
            allowNull: false,
            type: Sequelize.INTEGER,
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
