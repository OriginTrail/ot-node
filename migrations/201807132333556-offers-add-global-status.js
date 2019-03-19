
module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.addColumn(
            'offers',
            'global_status',
            {
                type: Sequelize.STRING,
            },
        ),
    down: queryInterface => queryInterface.removeColumn('offers', 'global_status'),
};
