module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.addColumn(
            'offers',
            'urgent',
            {
                type: Sequelize.BOOLEAN,
            },
        ),
    down: queryInterface => queryInterface.removeColumn('offers', 'urgent'),
};
