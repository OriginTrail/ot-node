module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'data_info',
            'otjson_size_in_bytes',
            {
                type: Sequelize.INTEGER,
            },
        );

        return queryInterface.addColumn(
            'data_info',
            'data_hash',
            {
                type: Sequelize.Sequelize.STRING,
            },
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('data_info', 'otjson_size_in_bytes');
        return queryInterface.removeColumn('data_info', 'data_hash');
    },
};