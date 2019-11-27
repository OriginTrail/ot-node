module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'network_query_responses',
            'data_size',
            {
                type: Sequelize.INTEGER,
            },
        );
        return queryInterface.renameColumn('network_query_responses', 'imports', 'data_set_ids');
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('network_query_responses', 'data_size');
        return queryInterface.renameColumn('network_query_responses', 'data_set_ids', 'imports');
    },
};
