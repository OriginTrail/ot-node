
module.exports = {
    up: async (queryInterface, Sequelize) =>
        queryInterface.addColumn(
            'holding_data',
            'litigation_root_hash',
            {
                type: Sequelize.STRING,
            },
        ),
    down: queryInterface => queryInterface.removeColumn('holding_data', 'litigation_root_hash'),
};
