module.exports = {
    up: async queryInterface => queryInterface.removeColumn('data_info', 'data_size'),
    down: async (queryInterface, Sequelize) => queryInterface.addColumn(
        'data_info',
        'data_size',
        {
            type: Sequelize.INTEGER,
        },
    ),
};
