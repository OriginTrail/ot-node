module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'offers',
            'number_of_replications',
            {
                type: Sequelize.INTEGER,
            },
        );

        await queryInterface.addColumn(
            'offers',
            'number_of_verified_replications',
            {
                type: Sequelize.INTEGER,
            },
        );

        await queryInterface.addColumn(
            'offers',
            'trac_in_eth_used_for_price_calculation',
            {
                type: Sequelize.STRING,
            },
        );

        await queryInterface.addColumn(
            'offers',
            'gas_price_used_for_price_calculation',
            {
                type: Sequelize.STRING,
            },
        );

        await queryInterface.addColumn(
            'offers',
            'price_factor_used_for_price_calculation',
            {
                type: Sequelize.INTEGER,
            },
        );

        return queryInterface.addColumn(
            'offers',
            'offer_finalize_transaction_hash',
            {
                type: Sequelize.STRING(128),
            },
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('offers', 'number_of_replications');
        await queryInterface.removeColumn('offers', 'number_of_verified_replications');
        await queryInterface.removeColumn('offers', 'trac_in_eth_used_for_price_calculation');
        await queryInterface.removeColumn('offers', 'gas_price_used_for_price_calculation');
        await queryInterface.removeColumn('offers', 'price_factor_used_for_price_calculation');
        return queryInterface.removeColumn('offers', 'offer_finalize_transaction_hash');
    },
};
