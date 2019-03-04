const models = require('../models/index');
const { forEach } = require('p-iteration');

module.exports = {
    up: async () => {
        const offers = await models.offers.findAll();
        return forEach(offers, async (offer) => {
            switch (offer.status) {
            case 'COMPLETED':
                offer.global_status = 'COMPLETED';
                break;
            case 'FAILED':
                offer.global_status = 'FAILED';
                break;
            default:
                offer.global_status = 'ACTIVE';
            }
            await offer.save({ fields: ['global_status'] });
        });
    },
    down: async (queryInterface) => {
    },
};
