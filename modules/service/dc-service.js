const BN = require('bn.js');

const models = require('../../models');

class DCService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Starts offer creation protocol
     * @param dataSetId
     * @param dataRootHash
     * @param holdingTimeInMinutes
     * @param tokenAmountPerHolder
     * @param dataSizeInBytes
     * @param litigationIntervalInMinutes
     * @returns {Promise<*>}
     */
    async createOffer(
        dataSetId, dataRootHash, holdingTimeInMinutes, tokenAmountPerHolder,
        dataSizeInBytes, litigationIntervalInMinutes,
    ) {
        const offer = await models.offers.create({
            data_set_id: dataSetId,
            message: 'Offer is pending',
            status: 'PENDING',
        });

        if (!holdingTimeInMinutes) {
            holdingTimeInMinutes = new BN(this.config.holding_time_in_minutes, 16);
        }

        if (!tokenAmountPerHolder) {
            tokenAmountPerHolder = new BN(this.config.token_amount_per_holder, 16);
        }

        if (!litigationIntervalInMinutes) {
            litigationIntervalInMinutes = new BN(this.config.litigation_interval_in_minutes, 16);
        }

        await this.commandExecutor.add({
            name: 'dcOfferPrepareCommand',
            sequence: [
                'dcOfferCreateDbCommand', 'dcOfferCreateBcCommand', 'dcOfferTaskCommand', 'dcOfferChooseCommand',
            ],
            delay: 0,
            data: {
                internalOfferId: offer.id,
                dataSetId,
                dataRootHash,
                holdingTimeInMinutes,
                tokenAmountPerHolder,
                dataSizeInBytes,
                litigationIntervalInMinutes,
            },
            transactional: false,
        });

        return offer.id;
    }

    /**
     * Completes offer and writes solution to the blockchain
     * @param offerId
     * @param solution
     * @returns {Promise<void>}
     */
    async miningSucceed(offerId, solution) {
        await this.commandExecutor.add({
            name: 'dcMiningCompletedCommand',
            delay: 0,
            solution,
            data: {
                offerId,
                solution,
                success: true,
            },
            transactional: false,
        });
    }

    /**
     * Fails offer
     * @param offerId
     * @returns {Promise<void>}
     */
    async miningFailed(offerId) {
        await this.commandExecutor.add({
            name: 'dcMiningCompletedCommand',
            delay: 0,
            data: {
                offerId,
                success: false,
            },
            transactional: false,
        });
    }

    /**
     * Handles replication request from one DH
     * @param offerId
     * @param wallet
     * @param identity
     * @returns {Promise<void>}
     */
    async handleReplicationRequest(offerId, wallet, identity) {
        this.logger.info(`Request for replication of offer external ID ${offerId} received. Sender ${identity}`);

        if (!offerId || !wallet) {
            this.logger.warn('Asked replication without providing offer ID or wallet.');
            return;
        }

        const offerModel = await models.offers.findOne({
            where: {
                offer_id: offerId,
            },
            order: [
                ['id', 'DESC'],
            ],
        });
        if (!offerModel) {
            this.logger.warn(`Replication request for offer external ID ${offerId} that I don't know.`);
            return;
        }
        const offer = offerModel.get({ plain: true });
        if (offer.status !== 'STARTED') {
            this.logger.warn(`Replication request for offer external ${offerId} that is not in STARTED state.`);
            return;
        }

        await this.commandExecutor.add({
            name: 'dcReplicationRequestCommand',
            delay: 0,
            data: {
                offerId,
                wallet,
                identity,
            },
            transactional: false,
        });
    }

    /**
     * Validates and adds DH signature
     * @param offerId
     * @param signature
     * @param dhNodeId
     * @param dhWallet
     * @returns {Promise<void>}
     */
    async verifyDHReplication(offerId, signature, dhNodeId, dhWallet) {
        await this.commandExecutor.add({
            name: 'dcVerifyReplicationCommand',
            delay: 0,
            data: {
                offerId,
                signature,
                dhNodeId,
                dhWallet,
            },
            transactional: false,
        });
    }
}

module.exports = DCService;
