const BN = require('bn.js');
const Utilities = require('../Utilities');
const Encryption = require('../Encryption');

const models = require('../../models');

const DEFAULT_NUMBER_OF_HOLDERS = 3;

class DCService {
    constructor(ctx) {
        this.web3 = ctx.web3;
        this.transport = ctx.transport;
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.blockchain = ctx.blockchain;
        this.commandExecutor = ctx.commandExecutor;
        this.replicationService = ctx.replicationService;
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
            global_status: 'PENDING',
        });

        if (!holdingTimeInMinutes) {
            holdingTimeInMinutes = new BN(this.config.dc_holding_time_in_minutes, 10);
        }

        if (!tokenAmountPerHolder) {
            tokenAmountPerHolder = new BN(this.config.dc_token_amount_per_holder, 10);
        }

        if (!litigationIntervalInMinutes) {
            litigationIntervalInMinutes = new BN(this.config.dc_litigation_interval_in_minutes, 10);
        }

        const hasFunds = await this.hasProfileBalanceForOffer(tokenAmountPerHolder);
        if (!hasFunds) {
            const message = 'Not enough tokens. To replicate data please deposit more tokens to your profile';
            this.logger.warn(message);
            throw new Error(message);
        }

        const commandData = {
            internalOfferId: offer.id,
            dataSetId,
            dataRootHash,
            holdingTimeInMinutes,
            tokenAmountPerHolder,
            dataSizeInBytes,
            litigationIntervalInMinutes,
        };
        const commandSequence = [
            'dcOfferPrepareCommand',
            'dcOfferCreateDbCommand',
            'dcOfferCreateBcCommand',
            'dcOfferTaskCommand',
            'dcOfferChooseCommand'];

        await this.commandExecutor.add({
            name: commandSequence[0],
            sequence: commandSequence.slice(1),
            delay: 0,
            data: commandData,
            transactional: false,
        });
        return offer.id;
    }

    /**
     * Check for funds
     * @param identities
     * @param tokenAmountPerHolder
     * @return {Promise<*>}
     */
    async checkDhFunds(identities, tokenAmountPerHolder) {
        const profileMinStake = new BN(await this.blockchain.getProfileMinimumStake(), 10);
        const excluded = await Promise.all(identities.map(async (identity) => {
            const profile = await this.blockchain.getProfile(identity);
            const profileStake = new BN(profile.stake, 10);
            const profileStakeReserved = new BN(profile.stakeReserved, 10);

            let remainder = null;
            const offerStake = new BN(tokenAmountPerHolder, 10);
            if (profileStake.sub(profileStakeReserved).lt(offerStake)) {
                remainder = offerStake.sub(profileStake.sub(profileStakeReserved));
            }

            if (profileStake.sub(profileStakeReserved).lt(profileMinStake)) {
                const stakeRemainder = profileMinStake.sub(profileStake.sub(profileStakeReserved));
                if (!remainder || (remainder && remainder.lt(stakeRemainder))) {
                    remainder = stakeRemainder;
                }
            }
            if (remainder) {
                return identity;
            }
            return null;
        }));
        return excluded.filter(e => e != null);
    }

    /**
     * Has enough balance on profile for creating an offer
     * @param tokenAmountPerHolder - Tokens per DH
     * @return {Promise<*>}
     */
    async hasProfileBalanceForOffer(tokenAmountPerHolder) {
        const profile = await this.blockchain.getProfile(this.config.erc725Identity);
        const profileStake = new BN(profile.stake, 10);
        const profileStakeReserved = new BN(profile.stakeReserved, 10);

        const offerStake = new BN(tokenAmountPerHolder, 10)
            .mul(new BN(DEFAULT_NUMBER_OF_HOLDERS, 10));

        let remainder = null;
        if (profileStake.sub(profileStakeReserved).lt(offerStake)) {
            remainder = offerStake.sub(profileStake.sub(profileStakeReserved));
        }

        const profileMinStake = new BN(await this.blockchain.getProfileMinimumStake(), 10);
        if (profileStake.sub(profileStakeReserved).sub(offerStake).lt(profileMinStake)) {
            const stakeRemainder = profileMinStake.sub(profileStake.sub(profileStakeReserved));
            if (!remainder || (remainder && remainder.lt(stakeRemainder))) {
                remainder = stakeRemainder;
            }
        }
        return !remainder;
    }

    /**
     * Completes offer and writes solution to the blockchain
     * @param data - Miner result
     * @returns {Promise<void>}
     */
    async miningSucceed(data) {
        const { offerId } = data;
        const mined = await models.miner_tasks.findOne({
            where: {
                offer_id: offerId,
            },
            order: [
                ['id', 'DESC'],
            ],
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
     * @param err - Miner error
     * @returns {Promise<void>}
     */
    async miningFailed(err) {
        const { offerId, message } = err;
        const mined = await models.miner_tasks.findOne({
            where: {
                offer_id: offerId,
            },
            order: [
                ['id', 'DESC'],
            ],
        });
        if (!mined) {
            throw new Error(`Failed to find offer ${offerId}. Something fatal has occurred!`);
        }
        mined.status = 'FAILED';
        mined.message = message;
        await mined.save({
            fields: ['message', 'status'],
        });
    }

    /**
     * Handles replication request from one DH
     * @param offerId - Offer ID
     * @param wallet - DH wallet
     * @param identity - Network identity
     * @param dhIdentity - DH ERC725 identity
     * @param response - Network response
     * @returns {Promise<void>}
     */
    async handleReplicationRequest(offerId, wallet, identity, dhIdentity, response) {
        this.logger.info(`Request for replication of offer external ID ${offerId} received. Sender ${identity}`);

        if (!offerId || !wallet) {
            const message = 'Asked replication without providing offer ID or wallet.';
            this.logger.warn(message);
            await this.transport.sendResponse(response, { status: 'fail', message });
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
            const message = `Replication request for offer external ID ${offerId} that I don't know.`;
            this.logger.warn(message);
            await this.transport.sendResponse(response, { status: 'fail', message });
            return;
        }
        const offer = offerModel.get({ plain: true });
        if (offer.status !== 'STARTED') {
            const message = `Replication request for offer external ${offerId} that is not in STARTED state.`;
            this.logger.warn(message);
            await this.transport.sendResponse(response, { status: 'fail', message });
        }

        await this._sendReplication(offer, wallet, identity, dhIdentity, response);
    }

    /**
     * Handles replication request from one DH
     * @param offerId - Offer ID
     * @param wallet - DH wallet
     * @param identity - Network identity
     * @param dhIdentity - DH ERC725 identity
     * @param response - Network response
     * @returns {Promise<void>}
     */
    async handleReplacementRequest(offerId, wallet, identity, dhIdentity, response) {
        this.logger.info(`Replacement request for replication of offer ${offerId} received. Sender ${identity}`);

        if (!offerId || !wallet) {
            const message = 'Asked replication without providing offer ID or wallet.';
            this.logger.warn(message);
            await this.transport.sendResponse(response, { status: 'fail', message });
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
            const message = `Replacement replication request for offer ID ${offerId} that I don't know.`;
            this.logger.warn(message);
            await this.transport.sendResponse(response, { status: 'fail', message });
            return;
        }
        const offer = offerModel.get({ plain: true });
        if (offer.global_status !== 'REPLACEMENT_STARTED') {
            const message = `Replication request for offer ${offerId} that is not in REPLACEMENT_STARTED state.`;
            this.logger.warn(message);
            await this.transport.sendResponse(response, { status: 'fail', message });
        }

        const usedDH = await models.replicated_data.findOne({
            where: {
                dh_id: identity,
                dh_wallet: wallet,
                dh_identity: dhIdentity,
                offer_id: offerId,
            },
        });

        if (usedDH != null) {
            this.logger.notify(`Cannot send replication to DH with network ID ${identity}. DH status is ${usedDH.status}.`);

            try {
                await this.transport.sendResponse(response, {
                    status: 'fail',
                });
            } catch (e) {
                this.logger.error(`Failed to send response 'fail' status. Error: ${e}.`);
            }
        }
        await this._sendReplication(offer, wallet, identity, dhIdentity, response);
    }

    /**
     * Handles replication request from one DH
     * @param offer - Offer
     * @param wallet - DH wallet
     * @param identity - Network identity
     * @param dhIdentity - DH ERC725 identity
     * @param response - Network response
     * @returns {Promise<void>}
     */
    async _sendReplication(offer, wallet, identity, dhIdentity, response) {
        const colors = ['red', 'green', 'blue'];
        const color = colors[Utilities.getRandomInt(2)];
        const colorNumber = this.replicationService.castColorToNumber(color);

        const replication = await this.replicationService.loadReplication(offer.id, color);
        await models.replicated_data.create({
            dh_id: identity,
            dh_wallet: wallet.toLowerCase(),
            dh_identity: dhIdentity.toLowerCase(),
            offer_id: offer.offer_id,
            litigation_private_key: replication.litigationPrivateKey,
            litigation_public_key: replication.litigationPublicKey,
            distribution_public_key: replication.distributionPublicKey,
            distribution_private_key: replication.distributionPrivateKey,
            distribution_epk_checksum: replication.distributionEpkChecksum,
            litigation_root_hash: replication.litigationRootHash,
            distribution_root_hash: replication.distributionRootHash,
            distribution_epk: replication.distributionEpk,
            status: 'STARTED',
            color: colorNumber.toNumber(),
        });

        const toSign = [
            Utilities.denormalizeHex(new BN(replication.distributionEpkChecksum).toString('hex')),
            Utilities.denormalizeHex(replication.distributionRootHash),
        ];
        const distributionSignature = Encryption.signMessage(
            this.web3, toSign,
            Utilities.normalizeHex(this.config.node_private_key),
        );

        const payload = {
            offer_id: offer.offer_id,
            data_set_id: offer.data_set_id,
            dc_wallet: this.config.node_wallet,
            edges: replication.edges,
            litigation_vertices: replication.litigationVertices,
            litigation_public_key: replication.litigationPublicKey,
            distribution_public_key: replication.distributionPublicKey,
            distribution_private_key: replication.distributionPrivateKey,
            distribution_epk_checksum: replication.distributionEpkChecksum,
            litigation_root_hash: replication.litigationRootHash,
            distribution_root_hash: replication.distributionRootHash,
            distribution_epk: replication.distributionEpk,
            distribution_signature: distributionSignature.signature,
            transaction_hash: offer.transaction_hash,
            distributionSignature,
            color: colorNumber.toNumber(),
        };

        // send replication to DH
        await this.transport.sendResponse(response, payload);
        this.logger.info(`Replication for offer ID ${offer.id} sent to ${identity}.`);
    }

    /**
     * Validates and adds DH signature
     * @param offerId
     * @param signature
     * @param dhNodeId
     * @param dhWallet
     * @param dhIdentity
     * @param isReplacement
     * @returns {Promise<void>}
     */
    async verifyDHReplication(offerId, signature, dhNodeId, dhIdentity, dhWallet, isReplacement) {
        await this.commandExecutor.add({
            name: 'dcReplicationCompletedCommand',
            delay: 0,
            data: {
                offerId,
                signature,
                dhNodeId,
                dhWallet,
                dhIdentity,
                isReplacement,
            },
            transactional: false,
        });
    }

    /**
     * Handles challenge response
     * @param answer - Challenge block ID
     * @param challengeId - Challenge ID used for reply
     * @return {Promise<void>}
     */
    async handleChallengeResponse(challengeId, answer) {
        this.logger.info(`Challenge response arrived for challenge ${challengeId}. Answer ${answer}`);

        const challenge = await models.challenges.findOne({
            where: { id: challengeId },
        });

        if (challenge == null) {
            this.logger.info(`Failed to find challenge ${challengeId}.`);
            return;
        }

        challenge.answer = answer;
        await challenge.save({ fields: ['answer'] });
    }
}

module.exports = DCService;
