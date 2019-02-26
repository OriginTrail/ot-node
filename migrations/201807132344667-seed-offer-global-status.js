const models = require('../models/index');
const { forEach } = require('p-iteration');

module.exports = {
    up: async () => {
        const offers = await models.offers.findAll();
        return forEach(offers, async (offer) => {
            offer.global_status = offer.status;
            await offer.save({ fields: ['global_status'] });
        });
    },
    down: async (queryInterface) => {
    },
};
