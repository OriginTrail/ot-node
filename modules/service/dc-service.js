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
        const depositCommand = await this.chainDepositCommandIfNeeded(
            tokenAmountPerHolder,
            commandData,
            commandSequence,
        );

        if (depositCommand) {
            await this.commandExecutor.add(depositCommand);
        } else {
            await this.commandExecutor.add({
                name: commandSequence[0],
                sequence: commandSequence.slice(1),
                delay: 0,
                data: commandData,
                transactional: false,
            });
        }
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
     * Creates commands needed for token deposit if there is a need for that
     * @param tokenAmountPerHolder
     * @param commandData
     * @param commandSequence
     * @return {Promise<*>}
     */
    async chainDepositCommandIfNeeded(tokenAmountPerHolder, commandData, commandSequence) {
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
        if (profileStake.sub(profileStakeReserved).lt(profileMinStake)) {
            const stakeRemainder = profileMinStake.sub(profileStake.sub(profileStakeReserved));
            if (!remainder || (remainder && remainder.lt(stakeRemainder))) {
                remainder = stakeRemainder;
            }
        }

        let depositCommand = null;
        if (remainder) {
            if (!this.config.deposit_on_demand) {
                const message = 'Not enough tokens. Deposit on demand feature is disabled. Please, enable it in your configuration.';
                this.logger.warn(message);
                throw new Error(message);
            }

            // deposit tokens
            depositCommand = {
                name: 'profileApprovalIncreaseCommand',
                sequence: [
                    'depositTokensCommand',
                ],
                delay: 0,
                data: {
                    amount: remainder.toString(),
                },
                transactional: false,
            };

            Object.assign(depositCommand.data, commandData);
            depositCommand.sequence = depositCommand.sequence.concat(commandSequence);
        }
        return depositCommand;
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
     * @param response
     * @returns {Promise<void>}
     */
    async handleReplicationRequest(offerId, wallet, identity, dhIdentity, response) {
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

        const colors = ['red', 'green', 'blue'];
        const color = colors[Utilities.getRandomInt(2)];

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
            color,
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
            offer_id: offerId,
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

    /**
     * Handles challenge response
     * @param answer - Challenge block ID
     * @param challengeId - Challenge ID used for reply
     * @return {Promise<void>}
     */
    async handleChallengeResponse(challengeId, answer) {
        this.logger.info(`Challenge response arrived for challenge ${challengeId}.`);

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
