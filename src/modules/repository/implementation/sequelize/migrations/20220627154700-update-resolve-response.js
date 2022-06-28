module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.renameColumn('resolve_response', 'resolve_id', 'handler_id');
        await queryInterface.changeColumn('resolve_response', 'handler_id', {
            type: Sequelize.UUID,
            allowNull: false,
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.changeColumn('resolve_response', 'handler_id', {
            type: Sequelize.INTEGER
        });
        await queryInterface.renameColumn('resolve_response', 'handler_id', 'resolve_id');
    },
};
