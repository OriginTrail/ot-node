const Models = require('../../models');
const Utilities = require('../Utilities');
const constants = require('../constants');

const { Op } = Models.Sequelize;

const BATCH_SIZE = 15;

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
        const blockchain_id = 'xdai:mainnet';

        // Dohvati event-ove na xdai-u koji nisu finished
        const events = await Models.events.findAll({
            where: {
                event: 'OfferFinalized',
                finished: 0,
                blockchain_id,
            },
        });

        const identity = this.profileService.getIdentity();

        const offers = [];
        const timestamps = {};
        events.forEach((event) => {
            const { data } = event;
            const { holder1, holder2, holder3 } = data;
            const holders = [holder1, holder2, holder3].map(h => Utilities.normalizeHex(h));

            // Od tih event-ova izvuci one koji pomenju moj identitet
            if (holders.includes(identity)) {
                this.logger.important(`Found missed offer ${data.offerId} finalized on blockchain ${blockchain_id}`);
                const offerId = Utilities.normalizeHex(data.offerId);
                offers.push(offerId);
                timestamps[offerId] = event.timestamp;
            }
        });

        const status = 'CHOSEN';
        await Models.bids.update({ status }, { where: { offer_id: { [Op.in]: offers } } });
        this.logger.important(`I've been chosen for offers ${JSON.stringify(offers)}.`);

        if (this.config.disableAutoPayouts !== true) {
            const bids = await Models.bids.findAll({ where: { offer_id: { [Op.in]: offers } } });

            const promises = [];
            for (const bid of bids) {
                const offerId = Utilities.normalizeHex(bid.offer_id);
                const offerStartTime = timestamps[offerId];
                let scheduledTime = offerStartTime +
                    (bid.holding_time_in_minutes * 60 * 1000) + (60 * 1000);
                scheduledTime -= Date.now();
                scheduledTime = Math.max(scheduledTime, 0);
                promises.push(this.commandExecutor.add({
                    name: 'dhPayOutCommand',
                    delay: scheduledTime,
                    transactional: false,
                    period: constants.GAS_PRICE_VALIDITY_TIME_IN_MILLS,
                    data: {
                        offerId: bid.offerId,
                        blockchain_id,
                        viaAPI: false,
                    },
                }));
            }

            await Promise.all(promises);
        }
    }
}

module.exports = M8MissedOfferCheckMigration;
