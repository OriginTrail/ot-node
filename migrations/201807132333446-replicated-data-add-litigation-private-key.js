
module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.addColumn(
            'replicated_data',
            'litigation_private_key',
            {
                type: Sequelize.STRING,
            },
        ),
    down: queryInterface => queryInterface.removeColumn('replicated_data', 'litigation_private_key'),
};
