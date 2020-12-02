module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'bids',
            'blockchain_id',
            {
                type: Sequelize.STRING,
            },
        );

        await queryInterface.sequelize.query('UPDATE bids SET blockchain_id = \'rinkeby\'');

        await queryInterface.changeColumn(
            'bids',
            'blockchain_id',
            {
                type: Sequelize.STRING,
                allowNull: false,
            },
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('bids', 'blockchain_id');
    },
};
