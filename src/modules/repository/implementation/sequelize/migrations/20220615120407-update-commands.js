module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'commands',
        'message',
        {
            type: Sequelize.TEXT('long'),
            allowNull: true,
        },
    ),
    down: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'commands',
        'message',
        {
            type: Sequelize.STRING,
            allowNull: true,
        },
    ),
};
