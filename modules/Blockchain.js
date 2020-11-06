const Ethereum = require('./Blockchain/Ethereum/index.js');
const uuidv4 = require('uuid/v4');
const Op = require('sequelize/lib/operators');

const Utilities = require('./Utilities');
const Models = require('../models');

class Blockchain {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.log = ctx.logger;
        this.web3 = ctx.web3;
        this.emitter = ctx.emitter;
        this.config = ctx.config.blockchain;
        this.pluginService = ctx.blockchainPluginService;
        this.gasStationService = ctx.gasStationService;
        this.tracPriceService = ctx.tracPriceService;
        this.appState = ctx.appState;

        this.blockchain = [];

        for (let i = 0; i < ctx.config.blockchain.implementations.length; i += 1) {
            const implementation_configuration = ctx.config.blockchain.implementations[i];

            switch (implementation_configuration.blockchain_title) {
            case 'Ethereum':
                this.blockchain[i] = new Ethereum(ctx, implementation_configuration);
                break;
            default:
                this.log.error('Unsupported blockchain', this.config.blockchain_title);
            }
        }

        this.pluginService.bootstrap();
    }

    /**
     * Initialize Blockchain provider
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            const promises = [];

            for (let i = 0; i < this.blockchain.length; i += 1) {
                promises.push(this.blockchain[i].initialize());
            }

            await Promise.all(promises);
        } catch (e) {
            this.log.warn(`Failed to initialize all blockchain implementations. ${e}`);
            throw e;
        }

        if (!this.initalized) {
            this.initalized = true;
            this.subscribeToEventPermanentWithCallback([
                'ContractsChanged',
            ], async (eventData) => {
                this.log.notify('Contracts changed, refreshing information.');
                await this.initialize();
            });
        }
    }

    /**
     * Executes specific plugin
     * @param name  - Plugin name
     * @param data  - Plugin data
     * @return {Promise<void>}
     */
    async executePlugin(name, data) {
        return this.pluginService.execute(name, data);
    }

    /**
     * Gets profile by wallet
     * @param identity
     */
    getProfile(identity, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            if (implementation) {
                return implementation.getProfile(identity);
            }
            throw Error(`Cannot find implementation for chain ${blockchain_id}`);
        }
        return this.blockchain[0].getProfile(identity);
    }

    /**
     * Set node ID
     * @param identity
     * @param nodeId
     */
    async setNodeId(identity, nodeId, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.setNodeId(identity, nodeId);
            }
            throw Error(`Cannot find implementation for chain ${blockchain_id}`);
        }
        return this.blockchain[0].setNodeId(identity, nodeId);
    }

    /**
     * Creates node profile on the Bidding contract
     * @param managementWallet - Management wallet
     * @param profileNodeId - Network node ID
     * @param initialBalance - Initial profile balance
     * @param isSender725 - Is sender ERC 725?
     * @param blockchainIdentity - ERC 725 identity (empty if there is none)
     * @return {Promise<any>}
     */
    createProfile(
        managementWallet,
        profileNodeId,
        initialBalance,
        isSender725,
        blockchainIdentity,
        blockchain_id,
    ) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.createProfile(
                managementWallet,
                profileNodeId, initialBalance, isSender725,
                blockchainIdentity,
            );
        }
        return this.blockchain[0].createProfile(
            managementWallet,
            profileNodeId, initialBalance, isSender725,
            blockchainIdentity,
        );
    }

    /**
     * Gets minimum stake for creating a profile
     * @returns {Promise<*>}
     */
    async getProfileMinimumStake(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.getProfileMinimumStake();
        }
        return this.blockchain[0].getProfileMinimumStake();
    }

    /**
     * Gets withdrawal time
     * @return {Promise<*>}
     */
    async getProfileWithdrawalTime() {
        return this.blockchain[0].getProfileWithdrawalTime();
    }

    /**
     * Increase token approval for escrow contract
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseProfileApproval(tokenAmountIncrease, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.increaseProfileApproval(tokenAmountIncrease);
        }
        return this.blockchain[0].increaseProfileApproval(tokenAmountIncrease);
    }

    /**
     * Initiate litigation for the particular DH
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param litigatorIdentity - Litigator identity
     * @param requestedObjectIndex - Order number of the object from the OT-dataset
     * @param requestedBlockIndex - Order number of the block inside the sorted object
     * @param hashArray - Merkle proof
     * @return {Promise<any>}
     */
    async initiateLitigation(
        offerId, holderIdentity, litigatorIdentity,
        requestedObjectIndex, requestedBlockIndex, hashArray,
    ) {
        return this.blockchain[0].initiateLitigation(
            offerId,
            holderIdentity, litigatorIdentity, requestedObjectIndex, requestedBlockIndex, hashArray,
        );
    }

    /**
     * Completes litigation for the particular DH
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param challengerIdentity - DC identity
     * @param proofData - answer
     * @param leafIndex - the number of the block in the lowest level of the merkle tree
     * @param urgent - Whether max gas price should or not
     * @return {Promise<void>}
     */
    async completeLitigation(
        offerId,
        holderIdentity,
        challengerIdentity,
        proofData,
        leafIndex,
        urgent,
    ) {
        return this.blockchain[0].completeLitigation(
            offerId, holderIdentity,
            challengerIdentity, proofData, leafIndex, urgent,
        );
    }

    /**
     * Answers litigation from DH side
     * @param offerId
     * @param holderIdentity
     * @param answer
     * @param urgent - Whether maximum gas price should be used
     * @return {Promise<any>}
     */
    answerLitigation(offerId, holderIdentity, answer, urgent) {
        return this.blockchain[0].answerLitigation(offerId, holderIdentity, answer, urgent);
    }

    /**
     * Pay out tokens
     * @param blockchainIdentity
     * @param offerId
     * @param urgent
     * @returns {Promise}
     */
    payOut(blockchainIdentity, offerId, urgent, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.payOut(blockchainIdentity, offerId, urgent);
        }
        return this.blockchain[0].payOut(blockchainIdentity, offerId, urgent);
    }

    /**
     * PayOut for multiple offers.
     * @returns {Promise<any>}
     */
    payOutMultiple(
        blockchainIdentity,
        offerIds,
    ) {
        return this.blockchain[0].payOutMultiple(
            blockchainIdentity,
            offerIds,
        );
    }

    /**
     * Creates offer for the data storing on the Ethereum blockchain.
     * @returns {Promise<any>} Return choose start-time.
     */
    createOffer(
        blockchainIdentity,
        dataSetId,
        dataRootHash,
        redLitigationHash,
        greenLitigationHash,
        blueLitigationHash,
        dcNodeId,
        holdingTimeInMinutes,
        tokenAmountPerHolder,
        dataSizeInBytes,
        litigationIntervalInMinutes,
        urgent,
    ) {
        return this.blockchain[0].createOffer(
            blockchainIdentity,
            dataSetId,
            dataRootHash,
            redLitigationHash,
            greenLitigationHash,
            blueLitigationHash,
            dcNodeId,
            holdingTimeInMinutes,
            tokenAmountPerHolder,
            dataSizeInBytes,
            litigationIntervalInMinutes,
            urgent,
        );
    }

    /**
     * Finalizes offer on Blockchain
     * @returns {Promise<any>}
     */
    finalizeOffer(
        blockchainIdentity,
        offerId,
        shift,
        confirmation1,
        confirmation2,
        confirmation3,
        encryptionType,
        holders,
        parentIdentity,
        urgent,
    ) {
        return this.blockchain[0].finalizeOffer(
            blockchainIdentity, offerId, shift, confirmation1,
            confirmation2, confirmation3, encryptionType, holders, parentIdentity, urgent,
        );
    }

    /**
     * Subscribe to a particular event
     * @param event
     * @param importId
     * @param endMs
     * @param endCallback
     * @param filterFn
     * @param blockchain_id
     */
    subscribeToEvent(event, importId, endMs = 5 * 60 * 1000, endCallback, filterFn, blockchain_id) {
        let implementation;

        return new Promise((resolve, reject) => {
            let clearToken;
            const token = setInterval(() => {
                const where = {
                    event,
                    finished: 0,
                };
                if (importId) {
                    where.import_id = importId;
                }
                if (blockchain_id) {
                    where.blockchain_id = blockchain_id;
                }

                Models.events.findAll({
                    where,
                }).then((events) => {
                    for (const eventData of events) {
                        const parsedData = JSON.parse(eventData.dataValues.data);

                        let ok = true;
                        if (filterFn) {
                            ok = filterFn(parsedData);
                        }
                        if (!ok) {
                            // eslint-disable-next-line
                            continue;
                        }
                        eventData.finished = true;
                        // eslint-disable-next-line no-loop-func
                        eventData.save().then(() => {
                            clearTimeout(clearToken);
                            clearInterval(token);
                            resolve(parsedData);
                        }).catch((err) => {
                            this.logger.error(`Failed to update event ${event}. ${err}`);
                            reject(err);
                        });
                        break;
                    }
                });
            }, 2000);
            clearToken = setTimeout(() => {
                if (endCallback) {
                    endCallback();
                }
                clearInterval(token);
                resolve(null);
            }, endMs);
        });
    }

    /**
     * Subscribes to Blockchain event
     *
     * Calling this method will subscribe to Blockchain's event which will be
     * emitted globally using globalEmitter.
     * @param event Event to listen to
     * @param blockchain_id - Blockchain to listen to
     * @returns {number | Object} Event handle
     */
    async subscribeToEventPermanent(event, blockchain_id) {
        const blockStartConditions = [];

        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            const startBlockNumber = await implementation.getCurrentBlock();
            blockStartConditions.push({
                blockchain_id,
                block: { [Op.gte]: startBlockNumber },
            });
        } else {
            const promises = [];

            for (let i = 0; i < this.blockchain.length; i += 1) {
                const implementation = this.blockchain[i];
                promises.push(implementation.getCurrentBlock());
            }
            const currentBlocks = await Promise.all(promises);

            for (let i = 0; i < currentBlocks.length; i += 1) {
                const implementation = this.blockchain[i];

                blockStartConditions.push({
                    blockchain_id: implementation.config.network_id,
                    block: { [Op.gte]: currentBlocks[i] },
                });
            }
        }

        const that = this;
        const handle = setInterval(async () => {
            if (!that.appState.started) {
                return;
            }

            const where = {
                event,
                finished: 0,
                [Op.or]: blockStartConditions,
            };

            const eventData = await Models.events.findAll({ where });
            if (eventData) {
                eventData.forEach(async (data) => {
                    const dataToSend = JSON.parse(data.dataValues.data);
                    dataToSend.blockchain_id = data.dataValues.blockchain_id;
                    this.emitter.emit(`eth-${data.event}`, dataToSend);
                    data.finished = true;
                    await data.save();
                });
            }
        }, 2000);

        return handle;
    }

    /**
     * Subscribes to Blockchain event with a callback specified
     *
     * Calling this method will subscribe to Blockchain's event which will be
     * emitted globally using globalEmitter.
     * Callback function will be executed when the event is emitted.
     * @param event - Name of event to listen to
     * @param callback - Function to be executed
     * @param blockchain_id - Blockchain to listen to
     * @returns {number | Object} Event handle
     */
    async subscribeToEventPermanentWithCallback(event, callback, blockchain_id) {
        const blockStartConditions = [];

        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            const startBlockNumber = await implementation.getCurrentBlock();
            blockStartConditions.push({
                blockchain_id,
                block: { [Op.gte]: startBlockNumber },
            });
        } else {
            const promises = [];

            for (let i = 0; i < this.blockchain.length; i += 1) {
                const implementation = this.blockchain[i];
                promises.push(implementation.getCurrentBlock());
            }
            const currentBlocks = await Promise.all(promises);

            for (let i = 0; i < currentBlocks.length; i += 1) {
                const implementation = this.blockchain[i];

                blockStartConditions.push({
                    blockchain_id: implementation.config.network_id,
                    block: { [Op.gte]: currentBlocks[i] },
                });
            }
        }
        const handle = setInterval(async () => {
            const where = {
                event,
                finished: 0,
                [Op.or]: blockStartConditions,
            };

            const eventData = await Models.events.findAll({ where });
            if (eventData) {
                eventData.forEach(async (data) => {
                    try {
                        callback({
                            name: `eth-${data.event}`,
                            value: JSON.parse(data.dataValues.data),
                            blockchain_id: data.blockchain_id,
                        });
                        data.finished = true;
                        await data.save();
                    } catch (error) {
                        this.logger.error(error);
                    }
                });
            }
        }, 2000);

        return handle;
    }

    /**
     * Gets all past events for the contract
     * @param contractName
     */
    async getAllPastEvents(contractName) {
        const promises = [];

        for (let i = 0; i < this.blockchain.length; i += 1) {
            const implementation = this.blockchain[i];
            const blockchain_id = this.blockchain[i].config.network_id;

            promises.push(this
                .getEventsFromImplementation(implementation, blockchain_id, contractName)
                .then((result) => {
                    this.handleReceivedEvents(result, contractName, blockchain_id);
                }));
        }

        await Promise.all(promises);
    }

    async getEventsFromImplementation(implementation, blockchain_id, contractName) {
        let fromBlock = 0;

        // Find last queried block if any.
        const lastEvent = await Models.events.findOne({
            where: {
                contract: contractName,
                blockchain_id,
            },
            order: [
                ['block', 'DESC'],
            ],
        });

        if (lastEvent) {
            fromBlock = lastEvent.block + 1;
        } else {
            const currentBlock = await implementation.getCurrentBlock();

            fromBlock = Math.max(currentBlock - 100, 0);
        }

        return implementation.getAllPastEvents(contractName, fromBlock);
    }

    async handleReceivedEvents(events, contractName, blockchain_id) {
        for (let i = 0; events && i < events.length; i += 1) {
            const event = events[i];
            const timestamp = Date.now();
            if (event.returnValues.DH_wallet) {
                event.returnValues.DH_wallet = event.returnValues.DH_wallet.toLowerCase();
            }
            /* eslint-disable-next-line */
            await Models.events.create({
                id: uuidv4(),
                contract: contractName,
                event: event.event,
                data: JSON.stringify(event.returnValues),
                data_set_id: Utilities.normalizeHex(event.returnValues.dataSetId),
                block: event.blockNumber,
                blockchain_id,
                timestamp,
                finished: 0,
            });
        }


        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        // Delete old events
        await Models.events.destroy({
            where: {
                timestamp: {
                    [Op.lt]: twoWeeksAgo.getTime(),
                },
                finished: 1,
            },
        });
    }

    async getStakedAmount(importId) {
        return this.blockchain[0].getStakedAmount(importId);
    }

    async getHoldingIncome(importId) {
        return this.blockchain[0].getHoldingIncome(importId);
    }

    async getPurchaseIncome(importId, dvWallet) {
        return this.blockchain[0].getPurchaseIncome(importId, dvWallet);
    }

    async getTotalPayouts(identity) {
        return this.blockchain[0].getTotalPayouts(identity);
    }

    /**
     * Gets balance from the profile
     * @param wallet
     * @returns {Promise}
     */
    getProfileBalance(wallet) {
        return this.blockchain[0].getProfileBalance(wallet);
    }

    /**
     * Deposits tokens to the profile
     * @param blockchainIdentity
     * @param amount
     * @returns {Promise<any>}
     */
    async depositTokens(blockchainIdentity, amount) {
        return this.blockchain[0].depositTokens(blockchainIdentity, amount);
    }

    /**
     * Gets root hash for import
     * @param dataSetId Data set ID
     * @return {Promise<any>}
     */
    async getRootHash(dataSetId, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.getRootHash(dataSetId);
        }
        return this.blockchain[0].getRootHash(dataSetId);
    }

    async getPurchase(purchaseId) {
        return this.blockchain[0].getPurchase(purchaseId);
    }

    async getPurchaseStatus(purchaseId) {
        return this.blockchain[0].getPurchaseStatus(purchaseId);
    }

    async getPurchasedData(importId, wallet) {
        return this.blockchain[0].getPurchasedData(importId, wallet);
    }

    async getPaymentStageInterval() {
        return this.blockchain[0].getPaymentStageInterval();
    }

    async initiatePurchase(
        sellerIdentity, buyerIdentity,
        tokenAmount,
        originalDataRootHash, encodedDataRootHash,
    ) {
        return this.blockchain[0].initiatePurchase(
            sellerIdentity, buyerIdentity,
            tokenAmount,
            originalDataRootHash, encodedDataRootHash,
        );
    }

    /**
     * Decodes offer task event data from offer creation event
     * @param result Blockchain transaction receipt
     * @returns {Promise<any>}
     */
    decodePurchaseInitiatedEventFromTransaction(result) {
        return this.blockchain[0].decodePurchaseInitiatedEventFromTransaction(result);
    }


    async depositKey(purchaseId, key) {
        return this.blockchain[0].depositKey(purchaseId, key);
    }

    async takePayment(purchaseId) {
        return this.blockchain[0].takePayment(purchaseId);
    }

    async complainAboutNode(
        purchaseId, outputIndex, inputIndexLeft, encodedOutput, encodedInputLeft,
        proofOfEncodedOutput, proofOfEncodedInputLeft, urgent,
    ) {
        return this.blockchain[0].complainAboutNode(
            purchaseId, outputIndex, inputIndexLeft, encodedOutput, encodedInputLeft,
            proofOfEncodedOutput, proofOfEncodedInputLeft, urgent,
        );
    }

    async complainAboutRoot(
        purchaseId, encodedRootHash, proofOfEncodedRootHash, rootHashIndex,
        urgent,
    ) {
        return this.blockchain[0].complainAboutRoot(
            purchaseId, encodedRootHash, proofOfEncodedRootHash, rootHashIndex,
            urgent,
        );
    }

    async sendCommitment(importId, dvWallet, commitment) {
        return this.blockchain[0].sendCommitment(importId, dvWallet, commitment);
    }

    async initiateDispute(importId, dhWallet) {
        return this.blockchain[0].initiateDispute(importId, dhWallet);
    }

    async confirmPurchase(importId, dhWallet) {
        return this.blockchain[0].confirmPurchase(importId, dhWallet);
    }

    async cancelPurchase(importId, correspondentWallet, senderIsDh) {
        return this.blockchain[0].cancelPurchase(importId, correspondentWallet, senderIsDh);
    }

    async sendProofData(
        importId, dvWallet, checksumLeft, checksumRight, checksumHash,
        randomNumber1, randomNumber2, decryptionKey, blockIndex,
    ) {
        return this.blockchain[0].sendProofData(
            importId, dvWallet, checksumLeft, checksumRight, checksumHash,
            randomNumber1, randomNumber2, decryptionKey, blockIndex,
        );
    }

    async sendEncryptedBlock(importId, dvWallet, encryptedBlock) {
        return this.blockchain[0].sendEncryptedBlock(importId, dvWallet, encryptedBlock);
    }

    /**
     * Pay out tokens from reading contract
     * @returns {Promise}
     * @param importId
     * @param dvWallet
     */
    async payOutForReading(importId, dvWallet) {
        return this.blockchain[0].payOutForReading(importId, dvWallet);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @param amount
     * @return {Promise<any>}
     */
    async startTokenWithdrawal(blockchainIdentity, amount) {
        return this.blockchain[0].startTokenWithdrawal(blockchainIdentity, amount);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @return {Promise<any>}
     */
    async withdrawTokens(blockchainIdentity) {
        return this.blockchain[0].withdrawTokens(blockchainIdentity);
    }

    /**
     * Get difficulty for the particular offer
     */
    async getOfferDifficulty(offerId) {
        return this.blockchain[0].getOfferDifficulty(offerId);
    }

    /**
     * Get all nodes which were added in the approval array
     */
    async getAddedNodes() {
        return this.blockchain[0].getAddedNodes();
    }

    /**
     * Get the statuses of all nodes which were added in the approval array
     */
    async getNodeStatuses() {
        return this.blockchain[0].getNodeStatuses();
    }

    /**
     * Check if a specific node still has approval
     * @param nodeId
     */
    async nodeHasApproval(nodeId) {
        return this.blockchain[0].nodeHasApproval(nodeId);
    }

    /**
     * Token contract address getter
     * @return {any|*}
     */
    getTokenContractAddress() {
        return this.blockchain[0].getTokenContractAddress();
    }

    /**
     * Returns purposes of the wallet.
     * @param erc725Identity {string}
     * @param wallet - {string}
     * @return {Promise<[]>}
     */
    getWalletPurposes(erc725Identity, wallet) {
        return this.blockchain[0].getWalletPurposes(erc725Identity, wallet);
    }

    /**
     * Transfers identity to new address.
     * @param erc725identity - {string}
     * @param managementWallet - {string}
     */
    transferProfile(erc725identity, managementWallet) {
        return this.blockchain[0].transferProfile(erc725identity, managementWallet);
    }

    /**
     * Returns true if ERC725 contract is older version.
     * @param address - {string} - address of ERC 725 identity.
     * @return {Promise<boolean>}
     */
    async isErc725IdentityOld(address) {
        return this.blockchain[0].isErc725IdentityOld(address);
    }

    /**
     * Get offer by ID
     * @param offerId - offer ID
     * @return {Promise<*>}
     */
    async getOffer(offerId, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.getOffer(offerId);
        }

        return this.blockchain[0].getOffer(offerId);
    }

    /**
     * Get holders for offer ID
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getHolder(offerId, holderIdentity) {
        return this.blockchain[0].getHolder(offerId, holderIdentity);
    }

    /**
     * Replaces holder
     * @returns {Promise<any>}
     */
    replaceHolder(
        offerId,
        holderIdentity,
        litigatorIdentity,
        shift,
        confirmation1,
        confirmation2,
        confirmation3,
        holders,
    ) {
        return this.blockchain[0].replaceHolder(
            offerId,
            holderIdentity,
            litigatorIdentity,
            shift,
            confirmation1,
            confirmation2,
            confirmation3,
            holders,
        );
    }

    /**
     * Gets litigation information for the holder
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigation(offerId, holderIdentity, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.getLitigation(offerId, holderIdentity);
        }
        return this.blockchain[0].getLitigation(offerId, holderIdentity);
    }

    /**
     * Gets litigation timestamp for the holder
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationTimestamp(offerId, holderIdentity) {
        return this.blockchain[0].getLitigationTimestamp(offerId, holderIdentity);
    }

    /**
     * Gets last litigation difficulty
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationDifficulty(offerId, holderIdentity) {
        return this.blockchain[0].getLitigationDifficulty(offerId, holderIdentity);
    }

    /**
     * Gets last litigation replacement task
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationReplacementTask(offerId, holderIdentity) {
        return this.blockchain[0].getLitigationReplacementTask(offerId, holderIdentity);
    }

    /**
     * Get staked amount for the holder
     */
    async getHolderStakedAmount(offerId, holderIdentity) {
        return this.blockchain[0].getHolderStakedAmount(offerId, holderIdentity);
    }

    /**
     * Get paid amount for the holder
     */
    async getHolderPaidAmount(offerId, holderIdentity) {
        return this.blockchain[0].getHolderPaidAmount(offerId, holderIdentity);
    }

    /**
     * Get litigation encryption type
     */
    async getHolderLitigationEncryptionType(offerId, holderIdentity) {
        return this.blockchain[0].getHolderLitigationEncryptionType(offerId, holderIdentity);
    }

    /**
     * Check that the identity key has a specific purpose
     * @param identity - identity address
     * @param key - identity key
     * @param pupose - purpose to verify
     * @return {Promise<any>}
     */
    async keyHasPurpose(identity, key, purpose) {
        return this.blockchain[0].keyHasPurpose(identity, key, purpose);
    }

    /**
     * Check how many events were emitted in a transaction from the transaction receipt
     * @param receipt - the json object returned as a result of the transaction
     * @return {Number | undefined} - Returns undefined if the receipt does not have a logs field
     */
    numberOfEventsEmitted(receipt) {
        return this.blockchain[0].numberOfEventsEmitted(receipt);
    }

    /**
     * Returns created identities from configuration
     */
    getIdentities() {
        const identities = [];
        for (let i = 0; i < this.blockchain.length; i += 1) {
            const identity = this.blockchain[i].getIdentity();

            identities.push({
                blockchain_id: this.blockchain[i].getBlockchainId(),
                response: identity ? { identity } : null,
            });
        }

        return identities;
    }

    /**
     * Returns created identities from configuration
     */
    getIdentity(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.getIdentity();
            }
        }
        return this.blockchain[0].getIdentity();
    }

    /**
     * Saves identity into file and configuration
     */
    saveIdentity(identity, blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.config.network_id === blockchain_id);

            return implementation.saveIdentity(identity);
        }
        this.blockchain[0].saveIdentity(identity);
    }

    /**
     * Returns the blockchain id of the default blockchain implementation
     */
    getDefaultBlockchainId() {
        return this.blockchain[0].getBlockchainId();
    }

    /**
     * Returns the hub contract address for a particular (od default) blockchain implementation
     */
    getHubContractAddress(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.getIdentity();
            }
        }
        return this.blockchain[0].getIdentity();
    }

    /**
     * Returns wallet public and private key from configuration
     */
    getWallet(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.getWallet();
            }
        }
        return this.blockchain[0].getWallet();
    }

    /**
     * Returns blockchain title from configuration
     */
    getBlockchainTitle(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.getBlockchainTitle();
            }
        }
        return this.blockchain[0].getBlockchainTitle();
    }

    /**
     * Returns gas price from configuration
     */
    getGasPrice(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.calculateGasPrice();
            }
        }
        return this.blockchain[0].calculateGasPrice();
    }

    /**
     * Returns trac price from configuration
     */
    getTracPrice(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.getTracPrice();
            }
        }
        return this.blockchain[0].getTracPrice();
    }

    /**
     * Returns price factors from configuration
     */
    getPriceFactors(blockchain_id) {
        if (blockchain_id) {
            const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

            if (implementation) {
                return implementation.getPriceFactors();
            }
        }
        return this.blockchain[0].getPriceFactors();
    }
}

module.exports = Blockchain;
