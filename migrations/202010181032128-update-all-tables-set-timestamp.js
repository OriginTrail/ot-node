const constats = require('../modules/constants');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface
            .changeColumn('events', 'timestamp', {
                type: Sequelize.BIGINT,
                allowNull: false,
            });
        await queryInterface
            .changeColumn('commands', 'ready_at', {
                type: Sequelize.BIGINT,
            });
        await queryInterface
            .changeColumn('commands', 'started_at', {
                type: Sequelize.BIGINT,
            });
        await queryInterface
            .changeColumn('commands', 'deadline_at', {
                type: Sequelize.BIGINT,
            });
        await queryInterface
            .changeColumn('offers', 'offer_id', {
                type: Sequelize.STRING,
            });
        await queryInterface
            .changeColumn('replicated_data', 'litigation_private_key', {
                type: Sequelize.TEXT,
            });
        await queryInterface
            .changeColumn('replicated_data', 'litigation_public_key', {
                type: Sequelize.TEXT,
            });
        await queryInterface
            .changeColumn('replicated_data', 'distribution_public_key', {
                type: Sequelize.TEXT,
            });
        await queryInterface
            .changeColumn('replicated_data', 'distribution_private_key', {
                type: Sequelize.TEXT,
            });
        await queryInterface
            .changeColumn('replicated_data', 'distribution_epk', {
                type: Sequelize.TEXT,
            });
        await queryInterface
            .changeColumn('challenges', 'start_time', {
                type: Sequelize.BIGINT,
            });
        await queryInterface
            .changeColumn('challenges', 'end_time', {
                type: Sequelize.BIGINT,
            });
        await queryInterface
            .changeColumn('reputation_data', 'timestamp', {
                type: Sequelize.BIGINT,
            });
        await queryInterface
            .changeColumn('handler_ids', 'timestamp', {
                type: Sequelize.BIGINT,
            });
    },
    down: async (queryInterface) => { },
};
