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
                unique: false,
            });
    },
    down: async (queryInterface) => { },
};
