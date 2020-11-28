module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn(
            'offers',
            'blockchain_id',
            {
                type: Sequelize.STRING,
            },
        );

        await queryInterface.sequelize.query('UPDATE offers SET blockchain_id = \'rinkeby\'');

        await queryInterface.changeColumn(
            'offers',
            'blockchain_id',
            {
                type: Sequelize.STRING,
                allowNull: false,
            },
        );
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('offers', 'blockchain_id');
    },
};
