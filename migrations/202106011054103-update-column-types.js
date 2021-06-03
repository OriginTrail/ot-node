const constats = require('../modules/constants');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface
            .changeColumn('public_keys', 'public_key', {
                type: Sequelize.TEXT,
            });
        await queryInterface
            .changeColumn('public_keys', 'timestamp', {
                type: Sequelize.BIGINT,
            });
        await queryInterface
            .changeColumn('offers', 'data_set_id', {
                type: Sequelize.STRING,
                unique: false,
            });
        await queryInterface
            .changeColumn('offers', 'price_factor_used_for_price_calculation', {
                type: Sequelize.STRING,
            });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface
            .changeColumn('public_keys', 'public_key', {
                type: Sequelize.STRING,
            });
        await queryInterface
            .changeColumn('public_keys', 'timestamp', {
                type: Sequelize.INTEGER,
            });
        await queryInterface
            .changeColumn('offers', 'data_set_id', {
                type: Sequelize.STRING,
                unique: true,
            });
        await queryInterface
            .changeColumn('offers', 'price_factor_used_for_price_calculation', {
                type: Sequelize.INTEGER,
            });
    },
};
