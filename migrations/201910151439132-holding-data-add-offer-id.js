module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.addColumn(
            'holding_data',
            'offer_id',
            {
                type: Sequelize.STRING,
            },
        ),
    down: queryInterface => queryInterface.removeColumn('holding_data', 'offer_id'),
};
