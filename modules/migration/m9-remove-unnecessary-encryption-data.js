const Models = require('../../models');

/**
 * Searches the operational database for missed OfferFinalized events
 */
class M9RemoveEncryptionDataMigration {
    constructor({
        logger, blockchain, config, profileService, replicationService,
    }) {
        this.logger = logger;
        this.config = config;
        this.blockchain = blockchain;
        this.profileService = profileService;
        this.replicationService = replicationService;
    }

    /**
     * Run migration
     */
    async run() {
        const result = [];
        const bids = await Models.bids.findAll({
            attributes: ['data_set_id', 'offer_id', 'blockchain_id', 'status'],
            where: {
                status: { [Models.Sequelize.Op.in]: ['CHOSEN', 'NOT_CHOSEN'] },
            },
        });

        const allMyIdentities = {};
        this.blockchain.getAllBlockchainIds()
            .forEach(id => allMyIdentities[id] = this.profileService.getIdentity(id));

        for (const bid of bids) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const holder = await this.blockchain
                    .getHolder(
                        bid.offer_id,
                        allMyIdentities[bid.blockchain_id],
                        bid.blockchain_id,
                    ).response;
                if (bid.status === 'CHOSEN' && holder.stakedAmount !== '0') {
                    const encryptionColor = this.replicationService
                        .castNumberToColor(parseInt(holder.litigationEncryptionType, 10));
                    result.push({
                        data_set_id: bid.data_set_id,
                        offer_id: bid.offer_id,
                        encryptionColor,
                    });
                } else if (bid.status === 'NOT_CHOSEN' && holder.stakedAmount === '0') {
                    result.push({
                        data_set_id: bid.data_set_id,
                        offer_id: bid.offer_id,
                        encryptionColor: null,
                    });
                }
            } catch (error) {
                this.logger.warn(`Unable to remove encryption data for offer id: ${bid.offer_id}. Error: ${error.message}`);
            }
        }

        return result;
    }
}

module.exports = M9RemoveEncryptionDataMigration;
