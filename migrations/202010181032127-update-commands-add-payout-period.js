const constats = require('../modules/constants');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const period = constats.GAS_PRICE_VALIDITY_TIME_IN_MILLS;
        await queryInterface.sequelize.query(`UPDATE commands SET period = ${period} WHERE name = 'dhPayOutCommand'`);
    },
    down: async (queryInterface) => { },
};
