const Models = require('../../models');

/**
 * Searches the operational database for missed OfferFinalized events
 */
class M9RemoveEncryptionDataMigration {
    constructor({
        logger, blockchain, config, profileService, replicationService, graphStorage,
    }) {
        this.logger = logger;
        this.config = config;
        this.blockchain = blockchain;
        this.profileService = profileService;
        this.replicationService = replicationService;
        this.graphStorage = graphStorage;
    }

    /**
     * Run migration
     */
    async run() {
        const bids = await Models.bids.findAll({
            attributes: ['data_set_id', 'offer_id', 'blockchain_id'],
        });

        const allMyIdentities = {};
        this.blockchain.getAllBlockchainIds()
            .forEach(id => allMyIdentities[id] = this.profileService.getIdentity(id));

        for (const bid of bids) {
            // eslint-disable-next-line no-await-in-loop
            const holder = await this.blockchain
                .getHolder(
                    bid.offer_id,
                    allMyIdentities[bid.blockchain_id],
                    bid.blockchain_id,
                ).response;
            let encryptionColor = null;
            if (holder.stakedAmount !== 0 && bid.status === '') {
                // i'm choosen for the offer
                encryptionColor = this.replicationService
                    .castNumberToColor(holder.litigationEncryptionType);
            }

            // eslint-disable-next-line no-await-in-loop
            await this.graphStorage.removeUnnecessaryEncryptionData(
                bid.data_set_id,
                bid.offer_id,
                encryptionColor,
            );
        }
    }
}

module.exports = M9RemoveEncryptionDataMigration;
