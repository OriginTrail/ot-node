module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('challenges', 'block_id');

        await queryInterface.addColumn(
            'challenges',
            'test_index',
            {
                type: Sequelize.INTEGER,
            },
        );

        await queryInterface.addColumn(
            'challenges',
            'object_index',
            {
                type: Sequelize.INTEGER,
            },
        );

        return queryInterface.addColumn(
            'challenges',
            'block_index',
            {
                type: Sequelize.INTEGER,
            },
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'challenges',
            'block_id',
            {
                type: Sequelize.INTEGER,
            },
        );

        await queryInterface.removeColumn('challenges', 'test_index');
        await queryInterface.removeColumn('challenges', 'object_index');
        return queryInterface.removeColumn('challenges', 'block_index');
    },
};
