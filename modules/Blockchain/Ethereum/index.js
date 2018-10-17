const fs = require('fs');
const Transactions = require('./Transactions');
const Utilities = require('../../Utilities');
const Models = require('../../../models');
const Op = require('sequelize/lib/operators');
const BN = require('bn.js');

class Ethereum {
    /**
     * Initializing Ethereum blockchain connector
     */
    constructor({
        config,
        emitter,
        web3,
        logger,
    }) {
        // Loading Web3
        this.emitter = emitter;
        this.web3 = web3;
        this.log = logger;

        this.globalConfig = config;
        this.config = {
            wallet_address: config.node_wallet,
            node_private_key: config.node_private_key,
            erc725Identity: config.erc725Identity,
        };
        Object.assign(this.config, config.blockchain);

        this.transactions = new Transactions(
            this.web3,
            this.config.wallet_address,
            this.config.node_private_key,
        );

        // Loading contracts
        this.hubContractAddress = this.config.hub_contract_address;

        const hubAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/hub.json');
        this.hubContractAbi = JSON.parse(hubAbiFile);
        this.hubContract = new this.web3.eth.Contract(this.hubContractAbi, this.hubContractAddress);

        this.log.info('Selected blockchain: Ethereum');
    }

    /**
     * Initializes Blockchain provider (get contract addresses, etc.)
     * @returns {Promise<void>}
     */
    async initialize() {
        // Holding contract data
        const holdingAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/holding.json');
        this.holdingContractAddress = await this._getHoldingContractAddress();
        this.holdingContractAbi = JSON.parse(holdingAbiFile);
        this.holdingContract = new this.web3.eth
            .Contract(this.holdingContractAbi, this.holdingContractAddress);

        // Token contract data
        const tokenAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/token.json');
        this.tokenContractAddress = await this._getTokenContractAddress();
        this.tokenContractAbi = JSON.parse(tokenAbiFile);
        this.tokenContract = new this.web3.eth.Contract(
            this.tokenContractAbi,
            this.tokenContractAddress,
        );

        // Reading contract data
        const readingAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/reading.json');
        this.readingContractAddress = await this._getReadingContractAddress();
        this.readingContractAbi = JSON.parse(readingAbiFile);
        this.readingContract = new this.web3.eth.Contract(
            this.readingContractAbi,
            this.readingContractAddress,
        );

        // Profile contract data
        const profileAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/profile.json');
        this.profileContractAddress = await this._getProfileContractAddress();
        this.profileContractAbi = JSON.parse(profileAbiFile);
        this.profileContract = new this.web3.eth.Contract(
            this.profileContractAbi,
            this.profileContractAddress,
        );

        // Profile storage contract data
        const profileStorageAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/profile-storage.json');
        this.profileStorageContractAddress = await this._getProfileStorageContractAddress();
        this.profileStorageContractAbi = JSON.parse(profileStorageAbiFile);
        this.profileStorageContract = new this.web3.eth.Contract(
            this.profileStorageContractAbi,
            this.profileStorageContractAddress,
        );

        // Holding storage contract data
        const holdingStorageAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/holding-storage.json');
        this.holdingStorageContractAddress = await this._getHoldingStorageContractAddress();
        this.holdingStorageContractAbi = JSON.parse(holdingStorageAbiFile);
        this.holdingStorageContract = new this.web3.eth.Contract(
            this.holdingStorageContractAbi,
            this.holdingStorageContractAddress,
        );

        this.contractsByName = {
            HOLDING_CONTRACT: this.holdingContract,
            PROFILE_CONTRACT: this.profileContract,
        };
    }

    /**
     * Gets Holding contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getHoldingContractAddress() {
        this.log.trace('Asking Hub for Holding contract address...');
        return this.hubContract.methods.holdingAddress().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Gets Token contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getTokenContractAddress() {
        this.log.trace('Asking Hub for Token contract address...');
        return this.hubContract.methods.tokenAddress().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Gets Reading contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getReadingContractAddress() {
        this.log.trace('Asking Hub for Holding contract address...');
        return this.hubContract.methods.readingAddress().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Gets Profile contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getProfileContractAddress() {
        this.log.trace('Asking Hub for Profile contract address...');
        return this.hubContract.methods.profileAddress().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Gets Profile storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getProfileStorageContractAddress() {
        this.log.trace('Asking Hub for ProfileStorage contract address...');
        return this.hubContract.methods.profileStorageAddress().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Gets Holding storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getHoldingStorageContractAddress() {
        this.log.trace('Asking Hub for HoldingStorage contract address...');
        return this.hubContract.methods.holdingStorageAddress().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Gets Reading storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getReadingStorageContractAddress() {
        this.log.trace('Asking Hub for ReadingStorage contract address...');
        return this.hubContract.methods.readingStorageAddress().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Writes data import root hash on Ethereum blockchain
     * @param importId
     * @param rootHash
     * @param importHash
     * @returns {Promise}
     */
    writeRootHash(importId, rootHash, importHash) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.otContractAddress,
        };

        const importIdHash = Utilities.soliditySHA3(importId);

        this.log.notify(`Writing root hash to blockchain for import ${importId}`);
        return this.transactions.queueTransaction(this.otContractAbi, 'addFingerPrint', [importId, importIdHash, rootHash, importHash], options);
    }

    /**
     * Gets root hash for import
     * @param dcWallet DC wallet
     * @param importId   Import ID
     * @return {Promise<any>}
     */
    async getRootHash(dcWallet, importId) {
        const importIdHash = Utilities.soliditySHA3(importId.toString());
        this.log.trace(`Fetching root hash for dcWallet ${dcWallet} and importIdHash ${importIdHash}`);
        return this.otContract.methods.getFingerprintByBatchHash(dcWallet, importIdHash).call();
    }

    /**
     * Gets profile balance by wallet
     * @param wallet
     * @returns {Promise}
     */
    getProfileBalance(wallet) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Getting profile balance by wallet ${wallet}`);
            this.tokenContract.methods.balanceOf(wallet).call()
                .then((res) => {
                    resolve(res);
                }).catch((e) => {
                    reject(e);
                });
        });
    }

    /**
     * Get offer by importId
     * @param importId
     * @returns {Promise}
     */
    getOffer(importId) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Get offer for import ${importId}`);
            this.biddingContract.methods.offer(importId).call().then((res) => {
                resolve(res);
            }).catch((e) => {
                reject(e);
            });
        });
    }

    /**
     * Gets the index of the node's bid in the array of one offer
     * @param importId Offer import id
     * @param dhNodeId KADemplia ID of the DH node that wants to get index
     * @returns {Promisse<any>} integer index in the array
     */
    getBidIndex(importId, nodeId) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Get bid index for import ${importId}`);
            this.biddingContract.methods.getBidIndex(
                importId,
                Utilities.normalizeHex(nodeId),
            ).call({
                from: this.config.wallet_address,
            }).then((res) => {
                resolve(res);
            }).catch((e) => {
                reject(e);
            });
        });
    }

    /**
     * Creates node profile on the Bidding contract
     * @param profileNodeId - Network node ID
     * @param initialBalance - Initial profile balance
     * @param isSender725 - Is sender ERC 725?
     * @param blockchainIdentity - ERC 725 identity (empty if there is none)
     * @return {Promise<any>}
     */
    createProfile(profileNodeId, initialBalance, isSender725, blockchainIdentity) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.profileContractAddress,
        };
        this.log.trace(`CreateProfile(${profileNodeId}, ${initialBalance}, ${isSender725})`);
        return this.transactions.queueTransaction(
            this.profileContractAbi, 'createProfile',
            [
                Utilities.normalizeHex(profileNodeId),
                initialBalance, isSender725, blockchainIdentity,
            ], options,
        );
    }

    /**
     * Increase token approval for profile
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseProfileApproval(tokenAmountIncrease) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.tokenContractAddress,
        };
        this.log.notify('Increasing token approval for profile contract');
        return this.transactions.queueTransaction(this.tokenContractAbi, 'increaseApproval', [this.profileContractAddress, tokenAmountIncrease], options);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @param amount
     * @return {Promise<any>}
     */
    startTokenWithdrawal(blockchainIdentity, amount) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.profileContractAddress,
        };
        this.log.trace(`startTokenWithdrawal(blockchainIdentity=${blockchainIdentity}, amount=${amount}`);
        return this.transactions.queueTransaction(this.profileContractAbi, 'startTokenWithdrawal', [blockchainIdentity, amount], options);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @return {Promise<any>}
     */
    withdrawTokens(blockchainIdentity) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.profileContractAddress,
        };
        this.log.trace(`withdrawTokens(blockchainIdentity=${blockchainIdentity}`);
        return this.transactions.queueTransaction(this.profileContractAbi, 'withdrawTokens', [blockchainIdentity], options);
    }

    /**
     * Increase token approval for Bidding contract on Ethereum blockchain
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseBiddingApproval(tokenAmountIncrease) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.tokenContractAddress,
        };
        this.log.notify('Increasing bidding approval');
        return this.transactions.queueTransaction(this.tokenContractAbi, 'increaseApproval', [this.biddingContractAddress, tokenAmountIncrease], options);
    }

    /**
     * Verify escrow contract contract data and start data holding process on Ethereum blockchain
     * @param importId
     * @param dhWallet
     * @returns {Promise}
     */
    verifyEscrow(importId, dhWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        this.log.notify(`Verify escrow for import ${importId} and DH ${dhWallet}`);
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'verifyEscrow',
            [
                importId,
                dhWallet,
            ],
            options,
        );
    }

    /**
     * DC initiates litigation on DH wrong challenge answer
     * @param importId
     * @param dhWallet
     * @param blockId
     * @param merkleProof
     * @return {Promise<any>}
     */
    initiateLitigation(importId, dhWallet, blockId, merkleProof) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };
        this.log.important(`Initiates litigation for import ${importId} and DH ${dhWallet}`);
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'initiateLitigation',
            [
                importId,
                dhWallet,
                blockId,
                merkleProof,
            ],
            options,
        );
    }
    /**
     * Answers litigation from DH side
     * @param importId
     * @param requestedData
     * @return {Promise<any>}
     */
    answerLitigation(importId, requestedData) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };
        this.log.important(`Answer litigation for import ${importId}`);
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'answerLitigation',
            [
                importId,
                requestedData,
            ],
            options,
        );
    }

    /**
     * Prooves litigation for particular DH
     * @param importId
     * @param dhWallet
     * @param proofData
     * @return {Promise<any>}
     */
    proveLitigation(importId, dhWallet, proofData) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };
        this.log.important(`Prove litigation for import ${importId} and DH ${dhWallet}`);
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'proveLitigaiton',
            [
                importId,
                dhWallet,
                proofData,
            ],
            options,
        );
    }
    /**
     * Cancel data holding escrow process on Ethereum blockchain
     * @param {string} - dhWallet
     * @param {number} - importId
     * @returns {Promise}
     */
    cancelEscrow(dhWallet, importId, dhIsSender) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        this.log.notify('Initiating escrow');
        return this.transactions.queueTransaction(
            this.escrowContractAbi,
            'cancelEscrow',
            [
                importId,
                dhWallet,
                dhIsSender,
            ],
            options,
        );
    }

    /**
     * Pay out tokens
     * @param blockchainIdentity
     * @param offerId
     * @returns {Promise}
     */
    payOut(blockchainIdentity, offerId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.holdingContractAddress,
        };
        this.log.trace(`payOut(blockchainIdentity=${blockchainIdentity}, offerId=${offerId}`);
        return this.transactions.queueTransaction(this.holdingContractAbi, 'payOut', [blockchainIdentity, offerId], options);
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
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.holdingContractAddress,
        };
        this.log.trace(`createOffer (${blockchainIdentity}, ${dataSetId}, ${dataRootHash}, ${redLitigationHash}, ${greenLitigationHash}, ${blueLitigationHash}, ${dcNodeId}, ${holdingTimeInMinutes}, ${tokenAmountPerHolder}, ${dataSizeInBytes}, ${litigationIntervalInMinutes})`);
        return this.transactions.queueTransaction(
            this.holdingContractAbi, 'createOffer',
            [
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
            ],
            options,
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
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.holdingContractAddress,
        };

        this.log.trace(`finalizeOffer (${blockchainIdentity}, ${offerId}, ${shift}, ${confirmation1}, ${confirmation2}, ${confirmation3}, ${encryptionType}, ${holders})`);
        return this.transactions.queueTransaction(
            this.holdingContractAbi, 'finalizeOffer',
            [
                blockchainIdentity,
                offerId,
                shift,
                confirmation1,
                confirmation2,
                confirmation3,
                encryptionType,
                holders,
            ],
            options,
        );
    }

    /**
     * Cancel offer for data storing on Ethereum blockchain.
     * @param importId Data if of the offer.
     */
    cancelOffer(importId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.notify('Initiating escrow to cancel offer');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'cancelOffer',
            [importId], options,
        );
    }

    /**
     * Gets all past events for the contract
     * @param contractName
     */
    async getAllPastEvents(contractName) {
        try {
            const currentBlock = Utilities.hexToNumber(await this.web3.eth.getBlockNumber());

            let fromBlock = 0;

            // Find last queried block if any.
            const lastEvent = await Models.events.findOne({
                where: {
                    contract: contractName,
                },
                order: [
                    ['block', 'DESC'],
                ],
            });

            if (lastEvent) {
                fromBlock = lastEvent.block + 1;
            } else {
                fromBlock = Math.max(currentBlock - 100, 0);
            }

            const events = await this.contractsByName[contractName].getPastEvents('allEvents', {
                fromBlock,
                toBlock: 'latest',
            });
            for (let i = 0; i < events.length; i += 1) {
                const event = events[i];
                const timestamp = Date.now();
                /* eslint-disable-next-line */
                await Models.events.create({
                    id: event.id,
                    contract: contractName,
                    event: event.event,
                    data: JSON.stringify(event.returnValues),
                    data_set_id: event.returnValues.dataSetId,
                    block: event.blockNumber,
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
        } catch (error) {
            if (error.msg && error.msg.includes('Invalid JSON RPC response')) {
                this.log.warn('Node failed to communicate with blockchain provider. Check internet connection');
            } else {
                this.log.trace(`Failed to get all passed events. ${error}.`);
            }
        }
    }

    /**
    * Subscribes to blockchain events
    * @param event
    * @param importId
    * @param filterFn
    * @param endMs
    * @param endCallback
    */
    subscribeToEvent(event, importId, endMs = 5 * 60 * 1000, endCallback, filterFn) {
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
                            this.log.error(`Failed to update event ${event}. ${err}`);
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
     * @returns {number | Object} Event handle
     */
    async subscribeToEventPermanent(event) {
        const startBlockNumber = parseInt(
            await Utilities.getBlockNumberFromWeb3(this.web3),
            16,
        );
        const handle = setInterval(async () => {
            const where = {
                [Op.or]: event.map(e => ({ event: e })),
                block: { [Op.gte]: startBlockNumber },
                finished: 0,
            };

            const eventData = await Models.events.findAll({ where });
            if (eventData) {
                eventData.forEach(async (data) => {
                    this.emitter.emit(`eth-${data.event}`, JSON.parse(data.dataValues.data));
                    data.finished = true;
                    await data.save();
                });
            }
        }, 2000);

        return handle;
    }

    unsubscribeToEventPermanent(eventHandle) {
        clearInterval(eventHandle);
    }

    /**
     * Checks if the node would rank in the top n + 1 network bids.
     * @param importId Offer import id
     * @returns {Promisse<any>} boolean whether node would rank in the top n + 1
     */
    getDistanceParameters(importId) {
        return new Promise((resolve, reject) => {
            this.log.trace('Check if close enough ... ');
            this.biddingContract.methods.getDistanceParameters(importId).call({
                from: this.config.wallet_address,
            }).then((res) => {
                resolve(res);
            }).catch((e) => {
                reject(e);
            });
        });
    }


    /**
     * Adds bid to the offer on Ethereum blockchain
     * @param importId Hash of the offer
     * @param dhNodeId KADemlia ID of the DH node that wants to add bid
     * @returns {Promise<any>} Index of the bid.
     */
    addBid(importId, dhNodeId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.notify(`Adding bid for import ID ${importId}.`);
        this.log.trace(`addBid(${importId}, ${dhNodeId})`);
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'addBid',
            [importId, Utilities.normalizeHex(dhNodeId)], options,
        );
    }

    /**
     * Activates predetermined bid in the offer on Ethereum blockchain
     * @param importId Hash of the offer
     * @param dhNodeId KADemlia ID of the DH node that wants to activate bid
     * @param bidIndex index of the bid in the array
     * @returns {Promise<any>} Index of the bid.
     */
    activatePredeterminedBid(importId, dhNodeId, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.notify('Initiating escrow to activate predetermined bid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'activatePredeterminedBid',
            [importId, Utilities.normalizeHex(dhNodeId), bidIndex], options,
        );
    }

    /**
     * Cancel the bid on Ethereum blockchain
     * @param dcWallet Wallet of the bidder
     * @param importId ID of the data of the bid
     * @param bidIndex Index of the bid
     * @returns {Promise<any>}
     */
    cancelBid(dcWallet, importId, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        this.log.notify('Initiating escrow to cancel bid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'cancelBid',
            [dcWallet, importId, bidIndex], options,
        );
    }

    /**
     * Starts choosing bids from contract escrow on Ethereum blockchain
     * @param importId Import ID
     * @returns {Promise<any>}
     */
    chooseBids(importId) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.notify('Initiating escrow to choose bid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'chooseBids',
            [importId], options,
        );
    }

    /**
     *
     * @param dcWallet
     * @param importId
     * @param bidIndex
     * @returns {Promise<any>}
     */
    getBid(dcWallet, importId, bidIndex) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.notify('Initiating escrow to get bid');
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'getBid',
            [dcWallet, importId, bidIndex], options,
        );
    }

    /**
    * Gets status of the offer
    * @param importId
    * @return {Promise<any>}
    */
    getOfferStatus(importId) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Asking for ${importId} offer status`);
            this.biddingContract.methods.getOfferStatus(importId).call()
                .then((res) => {
                    resolve(res);
                }).catch((e) => {
                    reject(e);
                });
        });
    }

    getDcWalletFromOffer(importId) {
        return new Promise((resolve, reject) => {
            this.log.trace(`Asking for offer's (${importId}) DC wallet.`);
            this.biddingContract.methods.offer(importId).call()
                .then((res) => {
                    resolve(res[0]);
                }).catch((e) => {
                    reject(e);
                });
        });
    }

    /**
     * Deposit tokens to profile
     * @param blockchainIdentity
     * @param amount
     * @returns {Promise<any>}
     */
    async depositTokens(blockchainIdentity, amount) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.profileContractAddress,
        };

        this.log.trace(`Calling - depositToken(${amount.toString()})`);
        return this.transactions.queueTransaction(
            this.profileContractAbi, 'depositTokens',
            [blockchainIdentity, amount], options,
        );
    }

    /**
     * Withdraw tokens from profile to wallet
     * @param {number} - amount
     * @returns {Promise<any>}
     */
    async withdrawToken(amount) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.biddingContractAddress,
        };

        this.log.trace(`Calling - withdrawToken(${amount.toString()})`);
        return this.transactions.queueTransaction(
            this.biddingContractAbi, 'withdrawToken',
            [amount], options,
        );
    }
    async addRootHashAndChecksum(importId, litigationHash, distributionHash, checksum) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.escrowContractAddress,
        };

        checksum = Utilities.normalizeHex(checksum);
        this.log.trace(`addRootHashAndChecksum (${importId}, ${litigationHash}, ${distributionHash}, ${checksum})`);
        return this.transactions.queueTransaction(
            this.escrowContractAbi, 'addRootHashAndChecksum',
            [importId, litigationHash, distributionHash, checksum], options,
        );
    }

    /**
     * Gets Escrow
     * @param dhWallet
     * @param importId
     * @return {Promise<any>}
     */
    async getEscrow(importId, dhWallet) {
        this.log.trace(`Asking escrow for import ${importId} and dh ${dhWallet}.`);
        return this.escrowContract.methods.escrow(importId, dhWallet).call();
    }

    async getPurchase(dhWallet, dvWallet, importId) {
        this.log.trace(`Asking purchase for import (purchase[${dhWallet}][${dvWallet}][${importId}].`);
        return this.readingContract.methods.purchase(dhWallet, dvWallet, importId).call();
    }

    async getPurchasedData(importId, wallet) {
        this.log.trace(`Asking purchased data for import ${importId} and wallet ${wallet}.`);
        return this.readingContract.methods.purchased_data(importId, wallet).call();
    }

    initiatePurchase(importId, dhWallet, tokenAmount, stakeFactor) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`initiatePurchase (${importId}, ${dhWallet}, ${tokenAmount}, ${stakeFactor})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'initiatePurchase',
            [importId, dhWallet, tokenAmount, stakeFactor], options,
        );
    }

    sendCommitment(importId, dvWallet, commitment) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`sendCommitment (${importId}, ${dvWallet}, ${commitment})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendCommitment',
            [importId, dvWallet, commitment], options,
        );
    }

    initiateDispute(importId, dhWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`initiateDispute (${importId}, ${dhWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'initiateDispute',
            [importId, dhWallet], options,
        );
    }

    confirmPurchase(importId, dhWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`confirmPurchase (${importId}, ${dhWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'confirmPurchase',
            [importId, dhWallet], options,
        );
    }

    cancelPurchase(importId, correspondentWallet, senderIsDh) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`confirmPurchase (${importId}, ${correspondentWallet}, ${senderIsDh})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'confirmPurchase',
            [importId, correspondentWallet, senderIsDh], options,
        );
    }

    sendProofData(
        importId, dvWallet, checksumLeft, checksumRight, checksumHash,
        randomNumber1, randomNumber2, decryptionKey, blockIndex,
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`sendProofData (${importId} ${dvWallet} ${checksumLeft} ${checksumRight} ${checksumHash}, ${randomNumber1}, ${randomNumber2} ${decryptionKey} ${blockIndex})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendProofData',
            [
                importId, dvWallet, checksumLeft, checksumRight, checksumHash,
                randomNumber1, randomNumber2, decryptionKey, blockIndex,
            ], options,
        );
    }

    async sendEncryptedBlock(importId, dvWallet, encryptedBlock) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`sendEncryptedBlock (${importId}, ${dvWallet}, ${encryptedBlock})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendEncryptedBlock',
            [importId, dvWallet, encryptedBlock], options,
        );
    }

    payOutForReading(importId, dvWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.readingContractAddress,
        };

        this.log.trace(`payOutForReading (${importId}, ${dvWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'payOut',
            [importId, dvWallet], options,
        );
    }

    /**
     * Get replication modifier
     */
    async getReplicationModifier() {
        this.log.trace('Get replication modifier from blockchain');
        return this.biddingContract.methods.replication_modifier().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get Profile minimum stake
     */
    async getProfileMinimumStake() {
        this.log.trace('Get replication modifier from blockchain');
        return this.profileContract.methods.minimalStake().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get profile by wallet
     * @param identity
     */
    async getProfile(identity) {
        this.log.trace(`Get profile by identity ${identity}`);
        return this.profileStorageContract.methods.profile(identity).call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get difficulty for the particular offer
     */
    async getOfferDifficulty(offerId) {
        this.log.trace(`getOfferDifficulty(offer=${offerId})`);
        return this.holdingStorageContract.methods.getOfferDifficulty(offerId).call({
            from: this.config.wallet_address,
        });
    }
}

module.exports = Ethereum;
