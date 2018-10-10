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
            holdingTimeInMinutes = new BN(1, 10); // TODO take from config
        }

        if (!tokenAmountPerHolder) {
            tokenAmountPerHolder = new BN(1, 10); // TODO take from config
        }

        if (!litigationIntervalInMinutes) {
            litigationIntervalInMinutes = new BN(1, 10); // TODO take from config
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
     * @param data - Miner result
     * @returns {Promise<void>}
     */
    async miningSucceed(data) {
        const { offerId } = data;
        const mined = await models.miner_records.findOne({
            where: { offer_id: offerId },
        });
        if (!mined) {
            throw new Error(`Failed to find offer ${offerId}. Something fatal has occurred!`);
        }
        mined.status = 'COMPLETED';
        mined.message = data.message;
        mined.result = data.result;
        await mined.save({
            fields: ['message', 'status', 'result'],
        });
    }

    /**
     * Fails offer
     * @param result - Miner result
     * @returns {Promise<void>}
     */
    async miningFailed(result) {
        const { offerId } = result;
        const mined = await models.miner_records.findOne({
            where: { offer_id: offerId },
        });
        if (!mined) {
            throw new Error(`Failed to find offer ${offerId}. Something fatal has occurred!`);
        }
        mined.status = 'FAILED';
        mined.message = result.message;
        await mined.save({
            fields: ['message', 'status'],
        });
    }

    /**
     * Handles replication request from one DH
     * @param offerId
     * @param wallet
     * @param identity
     * @param dhIdentity
     * @returns {Promise<void>}
     */
    async handleReplicationRequest(offerId, wallet, identity, dhIdentity) {
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
                dhIdentity,
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
     * @param dhIdentity
     * @returns {Promise<void>}
     */
    async verifyDHReplication(offerId, signature, dhNodeId, dhIdentity, dhWallet) {
        await this.commandExecutor.add({
            name: 'dcReplicationCompletedCommand',
            delay: 0,
            data: {
                offerId,
                signature,
                dhNodeId,
                dhWallet,
                dhIdentity,
            },
            transactional: false,
        });
    }
}

module.exports = DCService;
