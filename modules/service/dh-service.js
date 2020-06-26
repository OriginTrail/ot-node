const BN = require('bn.js');
const d3 = require('d3-format');
const Queue = require('better-queue');
const ethAbi = require('ethereumjs-abi');
const crypto = require('crypto');
const Op = require('sequelize/lib/operators');

const Models = require('../../models');
const Utilities = require('../Utilities');

const Graph = require('../Graph');
const Encryption = require('../RSAEncryption');
const ImportUtilities = require('../ImportUtilities');
const ObjectValidator = require('../validator/object-validator');

class DHService {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.config = ctx.config;
        this.commandExecutor = ctx.commandExecutor;
        this.blockchain = ctx.blockchain;
        this.transport = ctx.transport;
        this.web3 = ctx.web3;
        this.graphStorage = ctx.graphStorage;
        this.remoteControl = ctx.remoteControl;
        this.pricingService = ctx.pricingService;

        const that = this;
        this.queue = new Queue((async (args, cb) => {
            const {
                offerId,
                dcNodeId,
                dataSetSizeInBytes,
                holdingTimeInMinutes,
                litigationIntervalInMinutes,
                tokenAmountPerHolder,
                dataSetId,
                future,
            } = args;
            try {
                await that._handleOffer(
                    offerId,
                    dcNodeId,
                    dataSetSizeInBytes,
                    holdingTimeInMinutes,
                    litigationIntervalInMinutes,
                    tokenAmountPerHolder,
                    dataSetId,
                );
                future.resolve();
            } catch (e) {
                future.reject(e);
            }
            cb();
        }), { concurrent: 1 });
    }

    /**
     * Throttle offer using internal queue
     */
    handleOffer(
        offerId, dcNodeId,
        dataSetSizeInBytes, holdingTimeInMinutes, litigationIntervalInMinutes,
        tokenAmountPerHolder, dataSetId,
    ) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                offerId,
                dcNodeId,
                dataSetSizeInBytes,
                holdingTimeInMinutes,
                litigationIntervalInMinutes,
                tokenAmountPerHolder,
                dataSetId,
                future: {
                    resolve, reject,
                },
            });
        });
    }

    /**
     * Handles one offer
     * @returns {Promise<void>}
     */
    async _handleOffer(
        offerId, dcNodeId,
        dataSetSizeInBytes, holdingTimeInMinutes, litigationIntervalInMinutes,
        tokenAmountPerHolder, dataSetId,
    ) {
        if (dcNodeId === this.config.identity) {
            return; // the offer is mine
        }

        this.logger.notify(`Offer ${offerId} has been created by ${dcNodeId}.`);
        if (dataSetSizeInBytes) {
            const dataSizeInMB = dataSetSizeInBytes / 1000000;
            if (dataSizeInMB > this.config.dh_maximum_dataset_filesize_in_mb) {
                this.logger.info(`Data size in offer ${offerId} too big. Max allowed size is ${this.config.dh_maximum_dataset_filesize_in_mb}.`);
                return;
            }
        }
        const dhMaxHoldingTimeInMinutes = new BN(this.config.dh_max_holding_time_in_minutes, 10);
        if (dhMaxHoldingTimeInMinutes.lt(new BN(holdingTimeInMinutes, 10))) {
            this.logger.info(`Holding time for the offer ${offerId} is greater than my holding time defined.`);
            return;
        }

        const dhMinLitigationIntervalInMinutes =
            new BN(this.config.dh_min_litigation_interval_in_minutes, 10);
        if (dhMinLitigationIntervalInMinutes.gt(new BN(litigationIntervalInMinutes, 10))) {
            this.logger.info(`Litigation interval for the offer ${offerId} is lesser than the one defined in the config.`);
            return;
        }

        const offerPrice = await this.pricingService.calculateOfferPriceinTrac(
            dataSetSizeInBytes,
            holdingTimeInMinutes,
            this.config.blockchain.dh_price_factor,
        );
        const myOfferPrice = offerPrice.finalPrice;
        const dhTokenPrice = new BN(myOfferPrice.toString(), 10);

        if (dhTokenPrice.gt(new BN(tokenAmountPerHolder, 10))) {
            this.logger.info(`Offer ${offerId} too cheap for me.`);
            this.logger.info(`Price offered ${tokenAmountPerHolder}[mTRAC]`);
            this.logger.info(`My price for offer ${offerId}, ${myOfferPrice}[mTRAC]`);
            return;
        }

        this.logger.info(`Accepting offer with price: ${tokenAmountPerHolder} TRAC.`);
        const offer = await this.blockchain.getOffer(offerId);
        const bid = await Models.bids.create({
            offer_id: offerId,
            dc_identity: offer.creator,
            data_set_id: dataSetId,
            dc_node_id: dcNodeId,
            data_size_in_bytes: dataSetSizeInBytes,
            litigation_interval_in_minutes: litigationIntervalInMinutes,
            token_amount: tokenAmountPerHolder,
            holding_time_in_minutes: holdingTimeInMinutes,
            deposited: false,
            status: 'PENDING',
            message: 'Bid is still pending',
        });

        const remainder = await this._calculatePessimisticMinimumDeposit(
            bid.id,
            tokenAmountPerHolder,
        );

        if (remainder) {
            throw new Error('Not enough tokens. To take additional jobs please complete any finished jobs or deposit more tokens to your profile.');
        }

        const data = {
            offerId,
            dcNodeId,
            dataSetSizeInBytes,
            holdingTimeInMinutes,
            litigationIntervalInMinutes,
            tokenAmountPerHolder,
        };

        this.logger.trace('Waiting for DC to receive offer_id before sending replication request...');
        await this.commandExecutor.add({
            name: 'dhOfferHandleCommand',
            delay: 45000,
            data,
            transactional: false,
        });

        await this.remoteControl.getPendingBids();
    }

    /**
     * Calculates possible minimum amount to deposit (pessimistically)
     * @param bidId
     * @param tokenAmountPerHolder
     * @return {Promise<*>}
     * @private
     */
    async _calculatePessimisticMinimumDeposit(bidId, tokenAmountPerHolder) {
        const profile = await this.blockchain.getProfile(this.config.erc725Identity);
        const profileStake = new BN(profile.stake, 10);
        const profileStakeReserved = new BN(profile.stakeReserved, 10);
        const profileMinStake = new BN(await this.blockchain.getProfileMinimumStake(), 10);

        const offerStake = new BN(tokenAmountPerHolder, 10);

        const bids = await Models.bids.findAll({
            where: {
                id: {
                    [Op.ne]: bidId,
                },
                status: {
                    [Op.in]: ['SENT'],
                },
                deposit: {
                    [Op.ne]: null,
                },
            },
        });

        const currentDeposits = bids
            .map(pb => new BN(pb.deposit, 10))
            .reduce((acc, amount) => acc.add(amount), new BN(0, 10));

        let remainder = null;
        if (profileStake.sub(profileStakeReserved).sub(currentDeposits).lt(offerStake)) {
            remainder = offerStake.sub(profileStake.sub(profileStakeReserved).sub(currentDeposits));
        }

        if (profileStake
            .sub(profileStakeReserved)
            .sub(offerStake)
            .sub(currentDeposits)
            .lt(profileMinStake)) {
            const stakeRemainder = profileMinStake
                .sub(profileStake
                    .sub(profileStakeReserved)
                    .sub(offerStake)
                    .sub(currentDeposits));
            if (!remainder || (remainder && remainder.lt(stakeRemainder))) {
                remainder = stakeRemainder;
            }
        }
        return remainder;
    }

    /**
     * Handles one offer replacement
     * @param offerId - Offer ID
     * @param litigatorIdentity - DC node ERC725 identity
     * @param penalizedHolderIdentity - Penalized DH ERC725 identity
     * @param litigationRootHash - Litigation root hash
     * @param dcIdentity - DC identity
     * @return {Promise<void>}
     */
    async handleReplacement(
        offerId, litigatorIdentity,
        penalizedHolderIdentity, litigationRootHash, dcIdentity,
    ) {
        let bid = await Models.bids.findOne({
            where: {
                offer_id: offerId,
            },
        });

        if (bid && bid.status === 'CHOSEN') {
            this.logger.info(`I am already a holder for offer ${offerId}. Skipping replacement...`);
            return;
        }

        this.logger.info(`Not holding offer's data (${offerId}). Preparing for replacement...`);

        const penalizedPaidAmount = new BN(await this.blockchain.getHolderPaidAmount(
            offerId,
            penalizedHolderIdentity,
        ));
        const penalizedStakedAmount = new BN(await this.blockchain.getHolderStakedAmount(
            offerId,
            penalizedHolderIdentity,
        ));

        const stakeAmount = penalizedStakedAmount.sub(penalizedPaidAmount);

        const offerBc = await this.blockchain.getOffer(offerId);

        const offerSoFarInMillis = Date.now() - (offerBc.startTime * 1000);
        const offerSoFarInMinutes = new BN(offerSoFarInMillis / (60 * 1000), 10);
        const offerHoldingTimeInMinutes = new BN(offerBc.holdingTimeInMinutes, 10);
        const dhMaxHoldingTimeInMinutes = new BN(this.config.dh_max_holding_time_in_minutes, 10);

        const replacementDurationInMinutes = offerHoldingTimeInMinutes.sub(offerSoFarInMinutes);
        if (bid == null) {
            const profile =
                await this.blockchain.getProfile(Utilities.normalizeHex(litigatorIdentity));
            const dcNodeId =
                Utilities.denormalizeHex(profile.nodeId.toLowerCase()).substring(0, 40);
            bid = await Models.bids.create({
                offer_id: offerId,
                dc_identity: dcIdentity,
                data_set_id: offerBc.dataSetId,
                dc_node_id: dcNodeId,
                data_size_in_bytes: '0', // TODO fetch data size or calculate it upon successful import
                litigation_interval_in_minutes: offerBc.litigationIntervalInMinutes,
                token_amount: stakeAmount.toString(),
                holding_time_in_minutes: replacementDurationInMinutes.toString(),
                deposited: false,
                status: 'PENDING',
                message: 'Bid created for replacement',
            });
        } else {
            bid.token_amount = stakeAmount.toString();
            bid.holding_time_in_minutes = replacementDurationInMinutes.toString();
            bid.status = 'PENDING';
            bid.message = 'Bid created for replacement';
            await bid.save({ fields: ['token_amount', 'holding_time_in_minutes', 'status', 'message'] });
        }

        const remainder = await this._calculatePessimisticMinimumDeposit(
            bid.id,
            stakeAmount.toString(),
        );

        if (remainder) {
            bid.status = 'FAILED';
            bid.message = 'Not enough tokens';
            await bid.save({ fields: ['status', 'message'] });
            throw new Error('Not enough tokens. To take additional jobs please complete any finished jobs or deposit more tokens to your profile.');
        }

        if (dhMaxHoldingTimeInMinutes.lt(replacementDurationInMinutes)) {
            this.logger.info(`Replacement duration time for the offer ${offerId} is greater than my holding time defined.`);
            return;
        }

        const dhMinLitigationIntervalInMinutes =
            new BN(this.config.dh_min_litigation_interval_in_minutes, 10);
        if (dhMinLitigationIntervalInMinutes.gt(new BN(offerBc.litigationIntervalInMinutes, 10))) {
            this.logger.info(`Litigation interval for the offer ${offerId} is lesser than the one defined in the config.`);
            return;
        }

        const offer = await Models.offers.findOne({
            where: {
                offer_id: offerId,
            },
        });

        if (offer) {
            this.logger.info(`I created offer ${offerId}. Skipping replacement...`);
            return;
        }

        await this.commandExecutor.add({
            name: 'dhReplacementHandleCommand',
            delay: 45000,
            data: {
                offerId,
                litigatorIdentity,
                litigationRootHash,
            },
        });
    }

    /**
     * Handles one challenge
     * @param datasetId - Data set ID
     * @param offerId - Offer ID
     * @param objectIndex - Challenge object index
     * @param blockIndex - Challenge block index
     * @param challengeId - Challenge ID used for reply
     * @param litigatorNodeId - Litigator node ID
     * @return {Promise<void>}
     */
    async handleChallenge(
        datasetId,
        offerId,
        objectIndex,
        blockIndex,
        challengeId,
        litigatorNodeId,
    ) {
        this.logger.info(`Challenge arrived: Object index ${objectIndex}, Block index ${blockIndex}, Data set ID ${datasetId}`);
        await this.commandExecutor.add({
            name: 'dhChallengeCommand',
            retries: 4,
            data: {
                objectIndex,
                blockIndex,
                datasetId,
                offerId,
                challengeId,
                litigatorNodeId,
            },
        });
    }

    /**
     * Handle one read request (checks whether node satisfies query)
     * @param msgId       - Message ID
     * @param msgNodeId   - Message node ID
     * @param msgWallet   - Message wallet
     * @param msgQuery    - Message query
     * @returns {Promise<void>}
     */
    async handleDataLocationRequest(msgId, msgNodeId, msgWallet, msgQuery) {
        await this.commandExecutor.add({
            name: 'dhReadDataLocationRequestCommand',
            transactional: false,
            data: {
                msgId,
                msgNodeId,
                msgWallet,
                msgQuery,
            },
        });
    }

    /**
     * Handles data read request from Kademlia
     * @return {Promise<void>}
     */
    async handleDataReadRequest(message) {
        /*
            message: {
                id: REPLY_ID,
                import_id: IMPORT_ID,
                wallet: DH_WALLET,
                nodeId: KAD_ID
            }
        */

        // TODO in order to avoid getting a different import.
        const {
            nodeId, wallet, id, import_id,
        } = message;
        try {
            // Check is it mine offer.
            const networkReplyModel = await Models.network_replies.find({ where: { id } });
            if (!networkReplyModel) {
                throw Error(`Couldn't find reply with ID ${id}.`);
            }

            const offer = networkReplyModel.data;

            if (networkReplyModel.receiver_wallet !== wallet &&
                networkReplyModel.receiver_identity) {
                throw Error('Sorry not your read request');
            }

            // TODO: Only one import ID used. Later we'll support replication from multiple imports.
            // eslint-disable-next-line
            const importId = import_id;

            const verticesPromise = this.graphStorage.findVerticesByImportId(importId);
            const edgesPromise = this.graphStorage.findEdgesByImportId(importId);

            const values = await Promise.all([verticesPromise, edgesPromise]);
            const vertices = values[0];
            const edges = values[1];

            ImportUtilities.unpackKeys(vertices, edges);

            // Get replication key and then encrypt data.
            const holdingDataModel = await Models.holding_data.find({ where: { id: importId } });

            if (!holdingDataModel) {
                throw Error(`Didn't find import with ID. ${importId}`);
            }

            ImportUtilities.deleteInternal(edges);
            ImportUtilities.deleteInternal(vertices);
            const holdingData = holdingDataModel.get({ plain: true });
            const dataPublicKey = holdingData.data_public_key;
            const replicationPrivateKey = holdingData.distribution_private_key;

            Graph.decryptVertices(
                vertices.filter(vertex => vertex.vertex_type !== 'CLASS'),
                dataPublicKey,
            );

            Graph.encryptVertices(
                vertices.filter(vertex => vertex.vertex_type !== 'CLASS'),
                replicationPrivateKey,
            );

            // Make sure we have enough token balance before DV makes a purchase.
            // From smart contract:
            // require(DH_balance > stake_amount && DV_balance > token_amount.add(stake_amount));
            const condition = new BN(offer.dataPrice).mul(new BN(offer.stakeFactor));
            const profileBalance =
                new BN((await this.blockchain.getProfile(this.config.node_wallet)).balance, 10);

            if (profileBalance.lt(condition)) {
                throw new Error('Not enough funds to handle data read request');
            }

            /*
            dataReadResponseObject = {
                message: {
                    id: REPLY_ID
                    wallet: DH_WALLET,
                    nodeId: KAD_ID
                    agreementStatus: CONFIRMED/REJECTED,
                    data_provider_wallet,
                    encryptedData: { … }
                },
                messageSignature: {
                    c: …,
                    r: …,
                    s: …
               }
            }
             */

            const dataInfo = await Models.data_info.findOne({
                where: {
                    import_id: importId,
                },
            });

            if (!dataInfo) {
                throw Error(`Failed to get data info for import ID ${importId}.`);
            }

            const replyMessage = {
                id,
                wallet: this.config.node_wallet,
                nodeId: this.config.identity,
                data_provider_wallet: dataInfo.data_provider_wallet,
                agreementStatus: 'CONFIRMED',
                encryptedData: {
                    vertices,
                    edges,
                },
                import_id: importId, // TODO: Temporal. Remove it.
            };
            const dataReadResponseObject = {
                message: replyMessage,
                messageSignature: Utilities.generateRsvSignature(
                    replyMessage,
                    this.web3,
                    this.config.node_private_key,
                ),
            };

            await this.transport.sendDataReadResponse(dataReadResponseObject, nodeId);
            await this.listenPurchaseInititation(
                importId, wallet, offer, networkReplyModel,
                holdingData, nodeId, id,
            );
        } catch (e) {
            const errorMessage = `Failed to process data read request. ${e}.`;
            this.logger.warn(errorMessage);
            await this.transport.sendDataReadResponse({
                status: 'FAIL',
                message: errorMessage,
            }, nodeId);
        }
    }

    /**
     * Wait for purchase
     * @return {Promise<void>}
     */
    async listenPurchaseInititation(
        importId, wallet, offer,
        networkReplyModel, holdingData, nodeId, messageId,
    ) {
        // Wait for event from blockchain.
        await this.blockchain.subscribeToEvent('PurchaseInitiated', importId, 20 * 60 * 1000);

        // purchase[DH_wallet][msg.sender][import_id]
        const purchase = await this.blockchain.getPurchase(
            this.config.node_wallet,
            networkReplyModel.receiver_wallet,
            importId,
        );

        if (!purchase) {
            const errorMessage = `Failed to get purchase for: DH ${this.config.node_wallet}, DV ${networkReplyModel.receiver_wallet} and import ID ${importId}.`;
            this.logger.error(errorMessage);
            throw errorMessage;
        }

        // Check the conditions.
        const purchaseTokenAmount = new BN(purchase.token_amount);
        const purchaseStakeFactor = new BN(purchase.stake_factor);
        const myPrice = new BN(offer.dataPrice);
        const myStakeFactor = new BN(offer.stakeFactor);

        if (!purchaseTokenAmount.eq(myPrice) || !purchaseStakeFactor.eq(myStakeFactor)) {
            const errorMessage = `Whoa, we didn't agree on this. Purchase price and stake factor: ${purchaseTokenAmount} and ${purchaseStakeFactor}, my price and stake factor: ${myPrice} and ${myStakeFactor}.`;
            this.logger.error(errorMessage);
            throw errorMessage;
        }

        this.logger.info(`Purchase for import ${importId} seems just fine. Sending comm to contract.`);

        // bool commitment_proof = this_purchase.commitment ==
        // keccak256(checksum_left, checksum_right, checksum_hash,
        //          random_number_1, random_number_2, decryption_key, block_index);

        // Fetch epk from db.
        if (!holdingData) {
            this.logger.error(`Cannot find holding data info for import ID ${importId}`);
            throw Error('Internal error');
        }
        const { epk } = holdingData;

        const {
            m1,
            m2,
            selectedBlockNumber,
            selectedBlock,
        } = Encryption.randomDataSplit(epk);

        const r1 = Utilities.getRandomInt(100000);
        const r2 = Utilities.getRandomInt(100000);

        const m1Checksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(m1, r1, r2));
        const m2Checksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(
            m2,
            r1, r2, selectedBlockNumber + 1,
        ));
        const epkChecksum = Utilities.normalizeHex(Encryption.calculateDataChecksum(epk, r1, r2));
        const epkChecksumHash =
            Utilities.normalizeHex(ethAbi.soliditySHA3(
                ['uint256'],
                [epkChecksum],
            ).toString('hex'));
        const e = crypto.randomBytes(32); // 256bits.
        const eHex = Utilities.normalizeHex(e.toString('hex'));
        // For litigation we'll need: Encryption.xor(selectedBlock, e);

        // From smart contract:
        // keccak256(checksum_left, checksum_right, checksum_hash,
        //           random_number_1, random_number_2, decryption_key, block_index);
        const commitmentHash = Utilities.normalizeHex(ethAbi.soliditySHA3(
            ['uint256', 'uint256', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256'],
            [m1Checksum, m2Checksum, epkChecksumHash, r1, r2, eHex, selectedBlockNumber],
        ).toString('hex'));

        // store block number and block in db because of litigation.

        await this.blockchain.sendCommitment(
            importId,
            networkReplyModel.receiver_wallet,
            commitmentHash,
        );

        await Models.data_holders.create({
            import_id: importId,
            dh_wallet: this.config.node_wallet,
            dh_kademlia_id: this.config.identity,
            m1,
            m2,
            e: eHex,
            sd: epkChecksum,
            r1,
            r2,
            block_number: selectedBlockNumber,
            block: selectedBlock,
        });

        // Send data to DV.
        const encryptedPaddedKeyObject = {
            message: {
                id: messageId,
                wallet: this.config.node_wallet,
                nodeId: this.config.identifiers,
                m1,
                m2,
                e: eHex,
                r1,
                r2,
                sd: epkChecksum,
                blockNumber: selectedBlockNumber,
                import_id: importId,
            },
        };
        encryptedPaddedKeyObject.messageSignature = Utilities.generateRsvSignature(
            encryptedPaddedKeyObject.message,
            this.web3,
            this.config.node_private_key,
        );

        await this.transport.sendEncryptedKey(encryptedPaddedKeyObject, nodeId);

        this.listenPurchaseDispute(
            importId, wallet, m2Checksum,
            epkChecksumHash, selectedBlockNumber,
            m1Checksum, r1, r2, e,
        ).then(() => this.logger.info('Purchase dispute completed'));

        this.listenPurchaseConfirmation(
            importId, wallet, networkReplyModel,
            selectedBlock, eHex,
        ).then(() => this.logger.important('Purchase confirmation completed'));
    }

    /**
     * Wait and process purchase confirmation
     * @return {Promise<void>}
     */
    async listenPurchaseConfirmation(importId, wallet, networkReplyModel, selectedBlock, eHex) {
        const eventData = await this.blockchain.subscribeToEvent('PurchaseConfirmed', importId, 10 * 60 * 1000);
        if (!eventData) {
            // Everything is ok.
            this.logger.warn(`Purchase not confirmed for ${importId}.`);
            await this.blockchain.cancelPurchase(importId, wallet, true);
            this.logger.important(`Purchase for import ${importId} canceled.`);
            return;
        }

        this.logger.important(`[DH] Purchase confirmed for import ID ${importId}`);
        await this.blockchain.sendEncryptedBlock(
            importId,
            networkReplyModel.receiver_wallet,
            Utilities.normalizeHex(Encryption.xor(
                Buffer.from(selectedBlock, 'ascii').toString('hex'),
                Utilities.denormalizeHex(eHex),
            )),
        );
        this.logger.notify(`[DH] Encrypted block sent for import ID ${importId}`);
        this.blockchain.subscribeToEvent('PurchaseConfirmed', importId, 10 * 60 * 1000);

        // Call payOut() after 5 minutes. Requirement from contract.
        setTimeout(() => {
            this.blockchain.payOutForReading(importId, networkReplyModel.receiver_wallet)
                .then(() => this.logger.info(`[DH] Payout finished for import ID ${importId} and DV ${networkReplyModel.receiver_wallet}.`))
                .catch((error) => {
                    this.logger.info(`[DH] Payout failed for import ID ${importId} and DV ${networkReplyModel.receiver_wallet}. ${error}.`);
                });
        }, 5 * 60 * 1000);
    }

    /**
     * Monitor for litigation event. Just in case.
     * @return {Promise<void>}
     */
    async listenPurchaseDispute(
        importId, wallet, m2Checksum, epkChecksumHash,
        selectedBlockNumber, m1Checksum, r1, r2, e,
    ) {
        let eventData = await this.blockchain.subscribeToEvent('PurchaseDisputed', importId, 10 * 60 * 1000);
        if (!eventData) {
            // Everything is ok.
            this.logger.info(`No litigation process initiated for purchase for ${importId}.`);
            return;
        }

        await this.blockchain.sendProofData(
            importId, wallet, m1Checksum,
            m2Checksum, epkChecksumHash, r1, r2,
            Utilities.normalizeHex(e.toString('hex')), selectedBlockNumber,
        );

        // emit PurchaseDisputeCompleted(import_id, msg.sender, DV_wallet, false);
        eventData = this.blockchain.subscribeToEvent('PurchaseDisputeCompleted', importId, 10 * 60 * 1000);
        if (eventData.proof_was_correct) {
            this.logger.info(`Litigation process for purchase ${importId} was fortunate for me.`);
        } else {
            this.logger.info(`Litigation process for purchase ${importId} was unfortunate for me.`);
        }
    }

    async dataLocationQuery(queryId) {
        const networkQuery = await Models.network_queries.find({ where: { id: queryId } });
        const validationError = ObjectValidator.validateSearchQueryObject(networkQuery);
        if (validationError) {
            throw validationError;
        }
        if (networkQuery.status !== 'FINISHED') {
            throw Error('Query not finished.');
        }

        // Fetch the results.
        const importIds =
            await this.graphStorage.findImportIds(networkQuery.query);
        const decryptKeys = {};

        // Get decode keys.
        const holdingData = await Models.holding_data.findAll({
            where: {
                id: {
                    [Op.in]: importIds,
                },
            },
        });

        if (holdingData) {
            holdingData.forEach((data) => {
                decryptKeys[data.id] = data.data_public_key;
            });
        }

        const encodedVertices =
            await this.graphStorage.dataLocationQuery(networkQuery.query);
        const vertices = [];

        encodedVertices[0].objects.forEach((encodedVertex) => {
            const foundIds =
                encodedVertex.datasets.filter(value => importIds.indexOf(value) !== -1);

            switch (foundIds.length) {
            case 1:
                // Decrypt vertex.
                {
                    const decryptedVertex = Utilities.copyObject(encodedVertex);
                    decryptedVertex.data =
                        Encryption.decryptObject(
                            encodedVertex.data,
                            decryptKeys[foundIds[0]],
                        );
                    vertices.push(decryptedVertex);
                }
                break;
            case 0:
                // Vertex is not encrypted.
                vertices.push(Utilities.copyObject(encodedVertex));
                break;
            default:
                // Multiple keys founded. Temp solution.
                for (let i = 0; i < foundIds.length; i += 1) {
                    try {
                        const decryptedVertex = Utilities.copyObject(encodedVertex);
                        decryptedVertex.data =
                                Encryption.decryptObject(
                                    encodedVertex.data,
                                    decryptKeys[foundIds[i]],
                                );
                        vertices.push(decryptedVertex);
                        break; // Found the right key.
                    } catch (error) {
                        // Ignore.
                    }
                }
                break;
            }
        });

        return vertices;
    }

    async listenToBlockchainEvents() {
        this.blockchain.subscribeToEventPermanent([
            'OfferCreated',
            'NodeApproved',
            'NodeRemoved',
        ]);
    }
}

module.exports = DHService;
