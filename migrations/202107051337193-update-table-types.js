
module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface
            .changeColumn('network_replies', 'timestamp', {
                type: Sequelize.Date,
            });
        await queryInterface
            .changeColumn('commands', 'delay', {
                type: Sequelize.BIGINT,
            });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface
            .changeColumn('network_replies', 'timestamp', {
                type: Sequelize.INTEGER,
            });
        await queryInterface
            .changeColumn('commands', 'delay', {
                type: Sequelize.INTEGER,
            });
    },
};
