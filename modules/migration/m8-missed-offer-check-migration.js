const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');

const { Op } = Models.Sequelize;

/**
 * Searches the operational database for missed OfferFinalized events
 */
class M8MissedOfferCheckMigration {
    constructor({
        logger, blockchain, config, profileService, commandExecutor,
    }) {
        this.logger = logger;
        this.config = config;
        this.blockchain = blockchain;
        this.profileService = profileService;
        this.commandExecutor = commandExecutor;
    }

    /**
     * Run migration
     */
    async run() {
        const events = await Models.events.findAll({
            where: {
                event: 'OfferFinalized',
                finished: 0,
            },
        });

        const myIdentites = {};

        const offers = [];
        const offersData = {};
        for (let i = 0; i < events.length; i += 1) {
            const event = events[i];
            event.finished = 1;
            // eslint-disable-next-line no-await-in-loop
            await event.save({ fields: ['finished'] });
            const data = JSON.parse(event.data);
            const { holder1, holder2, holder3 } = data;
            const holders = [holder1, holder2, holder3].map(h => Utilities.normalizeHex(h));

            const { blockchain_id } = event;
            if (!myIdentites[blockchain_id]) {
                myIdentites[blockchain_id] = this.profileService.getIdentity(blockchain_id);
            }

            if (holders.includes(myIdentites[blockchain_id])) {
                this.logger.important(`Found missed offer ${data.offerId} finalized on blockchain ${blockchain_id}`);
                const offerId = Utilities.normalizeHex(data.offerId);
                offers.push(offerId);
                offersData[offerId] = {
                    timestamp: event.timestamp,
                    blockchainId: event.blockchain_id,
                };
            }
        }

        if (offers.length === 0) {
            return;
        }
        const status = 'CHOSEN';
        await Models.bids.update({ status }, { where: { offer_id: { [Op.in]: offers } } });
        this.logger.important(`I've been chosen for offers ${JSON.stringify(offers)}.`);

        if (this.config.disableAutoPayouts !== true) {
            const bids = await Models.bids.findAll({ where: { offer_id: { [Op.in]: offers } } });

            const promises = [];
            for (const bid of bids) {
                const offerId = Utilities.normalizeHex(bid.offer_id);
                const offerStartTime = offersData[offerId].timestamp;
                let scheduledTime = offerStartTime +
                    (bid.holding_time_in_minutes * 60 * 1000) + (60 * 1000);
                scheduledTime -= Date.now();
                promises.push(this.commandExecutor.add({
                    name: 'dhPayOutCommand',
                    delay: Math.max(scheduledTime, 0),
                    transactional: false,
                    period: constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS,
                    data: {
                        offerId,
                        blockchain_id: offersData[offerId].blockchainId,
                        viaAPI: false,
                    },
                }));
            }

            await Promise.all(promises);
        }
    }
}

module.exports = M8MissedOfferCheckMigration;
