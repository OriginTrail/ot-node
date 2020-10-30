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
     * Retrieves an implementation based on the given blockchain_id
     */
    _getImplementationFromId(blockchain_id) {
        if (!blockchain_id) {
            return this._getDefaultImplementation();
        }

        const implementation = this.blockchain.find(e => e.getBlockchainId() === blockchain_id);

        if (implementation && implementation.initalized) {
            return implementation;
        } else if (implementation) {
            throw new Error(`Cannot return implementation for blockchain_id ${blockchain_id}. Implementation is not initialized.`);
        } else {
            throw new Error(`Cannot return implementation for blockchain_id ${blockchain_id}. Implementation not found.`);
        }
    }

    _getDefaultImplementation() {
        for (const implementation of this.blockchain) {
            if (implementation.initalized) return implementation;
        }

        throw new Error('Cannot return implementation. No implementation is initialized.');
    }

    /**
     * Returns the blockchain id of the default blockchain implementation
     */
    getDefaultBlockchainId() {
        const implementation = this._getDefaultImplementation();
        return implementation.getBlockchainId();
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
     * @param blockchain_id
     */
    getProfile(identity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getProfile(identity);
    }

    /**
     * Set node ID
     * @param identity
     * @param nodeId
     * @param blockchain_id
     */
    async setNodeId(identity, nodeId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.setNodeId(identity, nodeId);
    }

    /**
     * Creates node profile on the Bidding contract
     * @param managementWallet - Management wallet
     * @param profileNodeId - Network node ID
     * @param initialBalance - Initial profile balance
     * @param isSender725 - Is sender ERC 725?
     * @param blockchainIdentity - ERC 725 identity (empty if there is none)
     * @param blockchain_id - Blockchain implementation
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
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.createProfile(
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
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getProfileMinimumStake();
    }

    /**
     * Increase token approval for escrow contract
     * @param {number} tokenAmountIncrease
     * @param {string} blockchain_id - Blockchain implementation to use
     * @returns {Promise}
     */
    increaseProfileApproval(tokenAmountIncrease, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.increaseProfileApproval(tokenAmountIncrease);
    }

    /**
     * Initiate litigation for the particular DH
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param litigatorIdentity - Litigator identity
     * @param requestedObjectIndex - Order number of the object from the OT-dataset
     * @param requestedBlockIndex - Order number of the block inside the sorted object
     * @param hashArray - Merkle proof
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async initiateLitigation(
        offerId, holderIdentity, litigatorIdentity,
        requestedObjectIndex, requestedBlockIndex, hashArray, blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.initiateLitigation(
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
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<void>}
     */
    async completeLitigation(
        offerId,
        holderIdentity,
        challengerIdentity,
        proofData,
        leafIndex,
        urgent,
        blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.completeLitigation(
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
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    answerLitigation(offerId, holderIdentity, answer, urgent, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.answerLitigation(offerId, holderIdentity, answer, urgent);
    }

    /**
     * Pay out tokens
     * @param blockchainIdentity
     * @param offerId
     * @param urgent
     * @param {string} blockchain_id - Blockchain implementation to use
     * @returns {Promise}
     */
    payOut(blockchainIdentity, offerId, urgent, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.payOut(blockchainIdentity, offerId, urgent);
    }

    /**
     * PayOut for multiple offers.
     * @param {string} blockchainIdentity - Blockchain identity to use
     * @param {string} offerIds - Offers to payOut
     * @param {string} blockchain_id - Blockchain implementation to use
     * @returns {Promise<any>}
     */
    payOutMultiple(
        blockchainIdentity,
        offerIds,
        blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.payOutMultiple(blockchainIdentity, offerIds);
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
        blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.createOffer(
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
        blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.finalizeOffer(
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
     * @param {string} blockchain_id - Blockchain implementation to use
     */
    subscribeToEvent(event, importId, endMs = 5 * 60 * 1000, endCallback, filterFn, blockchain_id) {
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
     * @param {string} blockchain_id - Blockchain implementation to listen to
     * @returns {number | Object} Event handle
     */
    async subscribeToEventPermanent(event, blockchain_id) {
        const blockStartConditions = [];

        if (blockchain_id) {
            const implementation = this._getImplementationFromId(blockchain_id);

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
     * @param {string} blockchain_id - Blockchain implementation to listen to
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

    async getStakedAmount(importId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getStakedAmount(importId);
    }

    async getHoldingIncome(importId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getHoldingIncome(importId);
    }

    async getPurchaseIncome(importId, dvWallet, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getPurchaseIncome(importId, dvWallet);
    }

    async getTotalPayouts(identity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getTotalPayouts(identity);
    }

    /**
     * Gets balance from the profile
     * @param wallet
     * @param {string} blockchain_id - Blockchain implementation to use
     * @returns {Promise}
     */
    getProfileBalance(wallet, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getProfileBalance(wallet);
    }

    /**
     * Deposits tokens to the profile
     * @param blockchainIdentity
     * @param amount
     * @param {string} blockchain_id - Blockchain implementation to use
     * @returns {Promise<any>}
     */
    async depositTokens(blockchainIdentity, amount, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.depositTokens(blockchainIdentity, amount);
    }

    /**
     * Gets root hash for import
     * @param dataSetId Data set ID
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async getRootHash(dataSetId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getRootHash(dataSetId);
    }

    async getPurchase(purchaseId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getPurchase(purchaseId);
    }

    async getPurchaseStatus(purchaseId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getPurchaseStatus(purchaseId);
    }

    async getPaymentStageInterval(blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getPaymentStageInterval();
    }

    async initiatePurchase(
        sellerIdentity, buyerIdentity,
        tokenAmount,
        originalDataRootHash, encodedDataRootHash, blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.initiatePurchase(
            sellerIdentity, buyerIdentity,
            tokenAmount,
            originalDataRootHash, encodedDataRootHash,
        );
    }

    /**
     * Decodes offer task event data from offer creation event
     * @param result Blockchain transaction receipt
     * @param {string} blockchain_id - Blockchain implementation to use
     * @returns {Promise<any>}
     */
    decodePurchaseInitiatedEventFromTransaction(result, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.decodePurchaseInitiatedEventFromTransaction(result);
    }


    async depositKey(purchaseId, key, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.depositKey(purchaseId, key);
    }

    async takePayment(purchaseId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.takePayment(purchaseId);
    }

    async complainAboutNode(
        purchaseId, outputIndex, inputIndexLeft, encodedOutput, encodedInputLeft,
        proofOfEncodedOutput, proofOfEncodedInputLeft, urgent, blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.complainAboutNode(
            purchaseId, outputIndex, inputIndexLeft, encodedOutput, encodedInputLeft,
            proofOfEncodedOutput, proofOfEncodedInputLeft, urgent,
        );
    }

    async complainAboutRoot(
        purchaseId, encodedRootHash, proofOfEncodedRootHash, rootHashIndex,
        urgent, blockchain_id,
    ) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.complainAboutRoot(
            purchaseId, encodedRootHash, proofOfEncodedRootHash, rootHashIndex,
            urgent,
        );
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @param amount
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async startTokenWithdrawal(blockchainIdentity, amount, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.startTokenWithdrawal(blockchainIdentity, amount);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async withdrawTokens(blockchainIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.withdrawTokens(blockchainIdentity);
    }

    /**
     * Get difficulty for the particular offer
     * @param {string} offerId, Offer id to get difficulty for
     * @param {string} blockchain_id - Blockchain implementation to use
     */
    async getOfferDifficulty(offerId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getOfferDifficulty(offerId);
    }

    /**
     * Token contract address getter
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {any|*}
     */
    getTokenContractAddress(blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getTokenContractAddress();
    }

    /**
     * Returns purposes of the wallet.
     * @param erc725Identity {string}
     * @param wallet - {string}
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<[]>}
     */
    getWalletPurposes(erc725Identity, wallet, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getWalletPurposes(erc725Identity, wallet);
    }

    /**
     * Get offer by ID
     * @param offerId - offer ID
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<*>}
     */
    async getOffer(offerId, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getOffer(offerId);
    }

    /**
     * Get holders for offer ID
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getHolder(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getHolder(offerId, holderIdentity);
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
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async getLitigation(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getLitigation(offerId, holderIdentity);
    }

    /**
     * Gets litigation timestamp for the holder
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async getLitigationTimestamp(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getLitigationTimestamp(offerId, holderIdentity);
    }

    /**
     * Gets last litigation difficulty
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async getLitigationDifficulty(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getLitigationDifficulty(offerId, holderIdentity);
    }

    /**
     * Gets last litigation replacement task
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @param {string} blockchain_id - Blockchain implementation to use
     * @return {Promise<any>}
     */
    async getLitigationReplacementTask(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getLitigationReplacementTask(offerId, holderIdentity);
    }

    /**
     * Get staked amount for the holder
     */
    async getHolderStakedAmount(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getHolderStakedAmount(offerId, holderIdentity);
    }

    /**
     * Get paid amount for the holder
     */
    async getHolderPaidAmount(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getHolderPaidAmount(offerId, holderIdentity);
    }

    /**
     * Get litigation encryption type
     */
    async getHolderLitigationEncryptionType(offerId, holderIdentity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getHolderLitigationEncryptionType(offerId, holderIdentity);
    }

    /**
     * Check that the identity key has a specific purpose
     * @param identity - identity address
     * @param key - identity key
     * @param purpose - purpose to verify
     * @param blockchain_id - implementation to use
     * @return {Promise<any>}
     */
    async keyHasPurpose(identity, key, purpose, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.keyHasPurpose(identity, key, purpose);
    }

    /**
     * Check how many events were emitted in a transaction from the transaction receipt
     * @param receipt - the json object returned as a result of the transaction
     * @param blockchain_id -
     * @return {Number | undefined} - Returns undefined if the receipt does not have a logs field
     */
    numberOfEventsEmitted(receipt, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.numberOfEventsEmitted(receipt);
    }

    /**
     * Returns created identities from blockchain implementations
     */
    getAllIdentities() {
        const identities = [];
        for (let i = 0; i < this.blockchain.length; i += 1) {
            const implementation = this.blockchain[i];
            if (implementation.initialized) {
                const identity = this.blockchain[i].getIdentity();

                identities.push({
                    blockchain_id: implementation.getBlockchainId(),
                    response: identity ? { identity } : null,
                });
            }
        }

        return identities;
    }

    /**
     * Returns created identities from configuration
     * @param {string} blockchain_id - Blockchain implementation to use
     */
    getIdentity(blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getIdentity();
    }

    /**
     * Saves identity into file and configuration
     * @param {string} blockchain_id - Blockchain implementation to use
     */
    saveIdentity(identity, blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.saveIdentity(identity);
    }

    /**
     * Returns the hub contract address for a particular (od default) blockchain implementation
     * @param {string} blockchain_id - Blockchain implementation to use
     */
    getHubContractAddress(blockchain_id) {
        const implementation = this._getImplementationFromId(blockchain_id);
        return implementation.getIdentity();
    }
}

module.exports = Blockchain;
