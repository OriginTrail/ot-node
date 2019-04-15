
module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.addColumn(
            'bids',
            'dc_identity',
            {
                type: Sequelize.STRING,
            },
        ),
    down: queryInterface => queryInterface.removeColumn('bids', 'dc_identity'),
};
