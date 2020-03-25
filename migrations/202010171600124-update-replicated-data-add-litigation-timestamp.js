module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'replicated_data',
            'last_litigation_timestamp',
            {
                type: Sequelize.DATE,
            },
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('replicated_data', 'last_litigation_timestamp');
    },
};
