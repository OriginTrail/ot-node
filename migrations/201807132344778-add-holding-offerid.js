
module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.addColumn(
            'holding',
            'offer_id',
            {
                type: Sequelize.STRING,
            },
        ),
    down: queryInterface => queryInterface.removeColumn('holding', 'offer_id'),
};
