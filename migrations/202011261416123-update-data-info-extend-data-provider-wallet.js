module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'data_info',
            'data_provider_wallets',
            {
                type: Sequelize.TEXT,
            },
        );

        // TODO Add migrating wallets from old column to new column

        await queryInterface.removeColumn('data_info', 'data_provider_wallet');
        await queryInterface.changeColumn(
            'data_info',
            'data_provider_wallets',
            {
                type: Sequelize.TEXT,
                allowNull: false,
            },
        );
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'data_info',
            'data_provider_wallet',
            {
                type: Sequelize.STRING,
            },
        );
        await queryInterface.removeColumn('data_info', 'data_provider_wallets');
    },
};
