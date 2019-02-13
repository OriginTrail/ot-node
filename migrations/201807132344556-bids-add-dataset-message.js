
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'bids',
            'data_set_id',
            {
                type: Sequelize.STRING,
            },
        );

        return queryInterface.addColumn(
            'bids',
            'message',
            {
                type: Sequelize.STRING,
            },
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('bids', 'data_set_id');
        return queryInterface.removeColumn('bids', 'message');
    },
};
