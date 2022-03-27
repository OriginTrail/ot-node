module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'handler_ids',
        'data',
        {
            type: Sequelize.TEXT('long'),
            allowNull: true,
        },
    ),
    down: (queryInterface, Sequelize) => queryInterface.changeColumn(
        'handler_ids',
        'data',
        {
            type: Sequelize.TEXT,
            allowNull: true,
        },
    ),
};
