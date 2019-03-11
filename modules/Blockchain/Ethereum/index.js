const fs = require('fs');
const Transactions = require('./Transactions');
const Utilities = require('../../Utilities');
const Models = require('../../../models');
const Op = require('sequelize/lib/operators');
const uuidv4 = require('uuid/v4');
const ethereumAbi = require('ethereumjs-abi');

class Ethereum {
    /**
     * Initializing Ethereum blockchain connector
     */
    constructor({
        config,
        emitter,
        web3,
        logger,
        appState,
    }) {
        // Loading Web3
        this.appState = appState;
        this.emitter = emitter;
        this.web3 = web3;
        this.log = logger;

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

        // Old Holding contract data
        const oldHoldingAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/holding.json');
        this.oldHoldingContractAddress = await this._getOldHoldingContractAddress();
        this.oldHoldingContractAbi = JSON.parse(oldHoldingAbiFile);
        this.oldHoldingContract = new this.web3.eth
            .Contract(this.oldHoldingContractAbi, this.oldHoldingContractAddress);

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

        // Approval contract data
        const approvalAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/approval.json');
        this.approvalContractAddress = await this._getApprovalContractAddress();
        this.approvalContractAbi = JSON.parse(approvalAbiFile);
        this.approvalContract = new this.web3.eth.Contract(
            this.approvalContractAbi,
            this.approvalContractAddress,
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

        // Old Holding storage contract data
        const oldHoldingStorageAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/holding-storage.json');
        this.oldHoldingStorageContractAddress = await this._getOldHoldingStorageContractAddress();
        this.oldHoldingStorageContractAbi = JSON.parse(oldHoldingStorageAbiFile);
        this.oldHoldingStorageContract = new this.web3.eth.Contract(
            this.oldHoldingStorageContractAbi,
            this.oldHoldingStorageContractAddress,
        );

        // Litigation contract data
        const litigationAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/litigation.json');
        this.litigationContractAddress = await this._getLitigationContractAddress();
        this.litigationContractAbi = JSON.parse(litigationAbiFile);
        this.litigationContract = new this.web3.eth.Contract(
            this.litigationContractAbi,
            this.litigationContractAddress,
        );

        // Litigation storage contract data
        const litigationStorageAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/litigation-storage.json');
        this.litigationStorageContractAddress = await this._getLitigationStorageContractAddress();
        this.litigationStorageContractAbi = JSON.parse(litigationStorageAbiFile);
        this.litigationStorageContract = new this.web3.eth.Contract(
            this.litigationStorageContractAbi,
            this.litigationStorageContractAddress,
        );

        // Litigation contract data
        const replacementAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/replacement.json');
        this.replacementContractAddress = await this._getReplacementContractAddress();
        this.replacementContractAbi = JSON.parse(replacementAbiFile);
        this.replacementContract = new this.web3.eth.Contract(
            this.replacementContractAbi,
            this.replacementContractAddress,
        );

        // ERC725 identity contract data. Every user has own instance.
        const erc725IdentityAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/erc725.json');
        this.erc725IdentityContractAbi = JSON.parse(erc725IdentityAbiFile);

        this.contractsByName = {
            HOLDING_CONTRACT: this.holdingContract,
            PROFILE_CONTRACT: this.profileContract,
            APPROVAL_CONTRACT: this.approvalContract,
            LITIGATION_CONTRACT: this.litigationContract,
            REPLACEMENT_CONTRACT: this.replacementContract,
        };
    }

    /**
     * Gets Holding contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getHoldingContractAddress() {
        this.log.trace('Asking Hub for Holding contract address...');
        const address = await this.hubContract.methods.getContractAddress('Holding').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Holding contract address is ${address}`);
        return address;
    }

    /**
     * Gets old Holding contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getOldHoldingContractAddress() {
        this.log.trace('Asking Hub for old Holding contract address...');
        const address = await this.hubContract.methods.getContractAddress('OldHolding').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Old Holding contract address is ${address}`);
        return address;
    }

    /**
     * Gets Token contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getTokenContractAddress() {
        this.log.trace('Asking Hub for Token contract address...');
        const address = await this.hubContract.methods.getContractAddress('Token').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Token contract address is ${address}`);
        return address;
    }

    /**
     * Gets Reading contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getReadingContractAddress() {
        this.log.trace('Asking Hub for Reading contract address...');
        const address = await this.hubContract.methods.getContractAddress('Reading').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Reading contract address is ${address}`);
        return address;
    }

    /**
     * Gets Profile contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getProfileContractAddress() {
        this.log.trace('Asking Hub for Profile contract address...');
        const address = await this.hubContract.methods.getContractAddress('Profile').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Profile contract address is ${address}`);
        return address;
    }

    /**
     * Gets Approval contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getApprovalContractAddress() {
        this.log.trace('Asking Hub for Approval contract address...');
        const address = await this.hubContract.methods.getContractAddress('Approval').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Approval contract address is ${address}`);
        return address;
    }

    /**
     * Gets Profile storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getProfileStorageContractAddress() {
        this.log.trace('Asking Hub for ProfileStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('ProfileStorage').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`ProfileStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets Holding storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getHoldingStorageContractAddress() {
        this.log.trace('Asking Hub for HoldingStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('HoldingStorage').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`HoldingStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets old Holding storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getOldHoldingStorageContractAddress() {
        this.log.trace('Asking Hub for old HoldingStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('OldHoldingStorage').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Old HoldingStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets Litigation contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getLitigationContractAddress() {
        this.log.trace('Asking Hub for Litigation contract address...');
        const address = await this.hubContract.methods.getContractAddress('Litigation').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Litigation contract address is ${address}`);
        return address;
    }

    /**
     * Gets Replacement contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getReplacementContractAddress() {
        this.log.trace('Asking Hub for Replacement contract address...');
        const address = await this.hubContract.methods.getContractAddress('Replacement').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`Replacement contract address is ${address}`);
        return address;
    }

    /**
     * Gets Litigation storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getLitigationStorageContractAddress() {
        this.log.trace('Asking Hub for LitigationStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('LitigationStorage').call({
            from: this.config.wallet_address,
        });
        this.log.trace(`LitigationStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets root hash for import
     * @param dataSetId Data set ID
     * @return {Promise<any>}
     */
    async getRootHash(dataSetId) {
        this.log.trace(`Fetching root hash for data set ${dataSetId}`);
        const rootHash = await this.holdingStorageContract.methods.fingerprint(dataSetId).call();
        if (Utilities.isZeroHash(rootHash)) {
            return this.oldHoldingStorageContract.methods.fingerprint(dataSetId).call();
        }
        return rootHash;
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
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.profileContractAddress,
        };
        this.log.trace(`CreateProfile(${managementWallet}, ${profileNodeId}, ${initialBalance}, ${isSender725}, ${blockchainIdentity})`);
        return this.transactions.queueTransaction(
            this.profileContractAbi, 'createProfile',
            [
                managementWallet,
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
        this.log.trace(`increaseProfileApproval(amount=${tokenAmountIncrease})`);
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
     * Answers litigation from DH side
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param answer - Litigation answer
     * @return {Promise<any>}
     */
    answerLitigation(offerId, holderIdentity, answer) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.litigationContractAddress,
        };
        this.log.trace(`answerLitigation (offerId=${offerId}, holderIdentity=${holderIdentity}, answer=${answer})`);
        return this.transactions.queueTransaction(
            this.litigationContractAbi,
            'answerLitigation',
            [
                offerId,
                holderIdentity,
                answer,
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
     * Pay out tokens
     * @param blockchainIdentity
     * @param offerId
     * @returns {Promise}
     */
    async payOut(blockchainIdentity, offerId) {
        let contractAddress = this.holdingContractAddress;

        const offer = await this.getOffer(offerId);
        if (Utilities.isZeroHash(offer['0'])) {
            contractAddress = this.oldHoldingContractAddress;
        }

        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: contractAddress,
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
    async finalizeOffer(
        blockchainIdentity,
        offerId,
        shift,
        confirmation1,
        confirmation2,
        confirmation3,
        encryptionType,
        holders,
    ) {
        let contractAddress = this.holdingContractAddress;

        const offer = await this.getOffer(offerId);
        if (Utilities.isZeroHash(offer['0'])) {
            contractAddress = this.oldHoldingContractAddress;
        }

        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: contractAddress,
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
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.replacementContractAddress,
        };

        this.log.trace(`replaceHolder (${offerId}, ${holderIdentity}, ${litigatorIdentity}, ${shift}, ${confirmation1}, ${confirmation2}, ${confirmation3}, ${holders})`);
        return this.transactions.queueTransaction(
            this.replacementContractAbi, 'replaceHolder',
            [
                offerId,
                holderIdentity,
                litigatorIdentity,
                shift,
                confirmation1,
                confirmation2,
                confirmation3,
                holders,
            ],
            options,
        );
    }

    /**
     * Gets all past events for the contract
     * @param contractName
     */
    async getAllPastEvents(contractName) {
        try {
            const currentBlock = await this.web3.eth.getBlockNumber();

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
        const startBlockNumber = await this.web3.eth.getBlockNumber();

        const that = this;
        return setInterval(async () => {
            if (!that.appState.started) {
                return;
            }
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
    }

    /**
     * Subscribes to Blockchain event with a callback specified
     *
     * Calling this method will subscribe to Blockchain's event which will be
     * emitted globally using globalEmitter.
     * Callback function will be executed when the event is emitted.
     * @param event Event to listen to
     * @param callback function to be executed
     * @returns {number | Object} Event handle
     */
    async subscribeToEventPermanentWithCallback(event, emitCallback) {
        const startBlockNumber = await this.web3.eth.getBlockNumber();

        const handle = setInterval(async () => {
            const where = {
                [Op.or]: event.map(e => ({ event: e })),
                block: { [Op.gte]: startBlockNumber },
                finished: 0,
            };

            const eventData = await Models.events.findAll({ where });
            if (eventData) {
                eventData.forEach(async (data) => {
                    try {
                        emitCallback({
                            name: `eth-${data.event}`,
                            value: JSON.parse(data.dataValues.data),
                        });
                        data.finished = true;
                        await data.save();
                    } catch (error) {
                        this.log.error(error);
                    }
                });
            }
        }, 2000);

        return handle;
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
     * Get Profile minimum stake
     */
    async getProfileMinimumStake() {
        this.log.trace('Get replication modifier from blockchain');
        return this.profileContract.methods.minimalStake().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get withdrawal time
     * @return {Promise<any>}
     */
    async getProfileWithdrawalTime() {
        this.log.trace('Get withdrawal time from blockchain');
        return this.profileContract.methods.withdrawalTime().call({
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

    /**
     * Get all nodes which were added in the approval array
     */
    async getAddedNodes() {
        this.log.trace('getAllNodes()');
        return this.approvalContract.methods.getAllNodes().call();
    }

    /**
     * Get the statuses of all nodes which were added in the approval array
     */
    async getNodeStatuses() {
        this.log.trace('getNodeStatuses()');
        return this.approvalContract.methods.getNodeStatuses().call();
    }

    /**
     * Check if a specific node still has approval
     * @param nodeId
     */
    async nodeHasApproval(nodeId) {
        nodeId = Utilities.normalizeHex(nodeId);
        this.log.trace(`nodeHasApproval(${nodeId})`);
        return this.approvalContract.methods.nodeHasApproval(nodeId).call();
    }

    /**
     * Token contract address getter
     * @return {any|*}
     */
    getTokenContractAddress() {
        return this.tokenContractAddress;
    }

    /**
     * Returns purposes of the wallet.
     * @param {string} - erc725Identity
     * @param {string} - wallet
     * @return {Promise<[]>}
     */
    getWalletPurposes(erc725Identity, wallet) {
        const erc725IdentityContract = new this.web3.eth.Contract(
            this.erc725IdentityContractAbi,
            erc725Identity,
        );

        const key = ethereumAbi.soliditySHA3(['address'], [wallet]).toString('hex');
        return erc725IdentityContract.methods.getKeyPurposes(Utilities.normalizeHex(key)).call();
    }

    /**
     * Transfers identity to new address.
     * @param {string} - erc725identity
     * @param {string} - managementWallet
     */
    transferProfile(erc725identity, managementWallet) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.profileContractAddress,
        };

        this.log.trace(`transferProfile (${erc725identity}, ${managementWallet})`);
        return this.transactions.queueTransaction(
            this.profileContractAbi, 'transferProfile',
            [erc725identity, managementWallet], options,
        );
    }

    /**
     * Returns true if ERC725 contract is older version.
     * @param {string} - address of ERC 725 identity.
     * @return {Promise<boolean>}
     */
    async isErc725IdentityOld(address) {
        const erc725IdentityContract = new this.web3.eth.Contract(
            this.erc725IdentityContractAbi,
            address,
        );

        try {
            await erc725IdentityContract.methods.otVersion().call();
            return false;
        } catch (error) {
            if (error.toString().includes('Couldn\'t decode uint256 from ABI: 0x')) {
                return true;
            }
            throw error;
        }
    }

    /**
     * Get offer by offer ID
     * @param offerId - Offer ID
     * @return {Promise<any>}
     */
    async getOffer(offerId) {
        this.log.trace(`getOffer(offerId=${offerId})`);
        return this.holdingStorageContract.methods.offer(offerId).call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get holders for offer ID
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getHolder(offerId, holderIdentity) {
        this.log.trace(`getHolder(offerId=${offerId}, holderIdentity=${holderIdentity})`);
        return this.holdingStorageContract.methods.holder(offerId, holderIdentity).call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Initiate litigation for the particular DH
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param litigatorIdentity - Litigator identity
     * @param requestedDataIndex - Block ID
     * @param hashArray - Merkle proof
     * @return {Promise<any>}
     */
    async initiateLitigation(
        offerId, holderIdentity, litigatorIdentity,
        requestedDataIndex, hashArray,
    ) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.litigationContractAddress,
        };

        this.log.trace(`initiateLitigation (offerId=${offerId}, holderIdentity=${holderIdentity}, litigatorIdentity=${litigatorIdentity}, requestedDataIndex=${requestedDataIndex}, hashArray=${hashArray})`);
        return this.transactions.queueTransaction(
            this.litigationContractAbi, 'initiateLitigation',
            [offerId, holderIdentity, litigatorIdentity, requestedDataIndex, hashArray], options,
        );
    }

    /**
     * Completes litigation for the particular DH
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param challengerIdentity - DC identity
     * @param proofData - answer
     * @return {Promise<void>}
     */
    async completeLitigation(offerId, holderIdentity, challengerIdentity, proofData) {
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(this.config.gas_price),
            to: this.litigationContractAddress,
        };

        this.log.trace(`completeLitigation (offerId=${offerId}, holderIdentity=${holderIdentity}, challengerIdentity=${challengerIdentity}, proofData=${proofData})`);
        return this.transactions.queueTransaction(
            this.litigationContractAbi, 'completeLitigation',
            [offerId, holderIdentity, challengerIdentity, proofData], options,
        );
    }

    /**
     * Gets last litigation timestamp for the holder
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationTimestamp(offerId, holderIdentity) {
        this.log.trace(`getLitigationTimestamp(offerId=${offerId}, holderIdentity=${holderIdentity})`);
        return this.litigationStorageContract
            .methods.getLitigationTimestamp(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Gets last litigation difficulty
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationDifficulty(offerId, holderIdentity) {
        this.log.trace(`getLitigationDifficulty(offerId=${offerId}, holderIdentity=${holderIdentity})`);
        return this.litigationStorageContract
            .methods.getLitigationReplacementDifficulty(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Gets last litigation replacement task
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationReplacementTask(offerId, holderIdentity) {
        this.log.trace(`getLitigationReplacementTask(offerId=${offerId}, holderIdentity=${holderIdentity})`);
        return this.litigationStorageContract
            .methods.getLitigationReplacementTask(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Get staked amount for the holder
     */
    async getHolderStakedAmount(offerId, holderIdentity) {
        this.log.trace(`getHolderStakedAmount(offer=${offerId}, holderIdentity=${holderIdentity})`);
        return this.holdingStorageContract.methods
            .getHolderStakedAmount(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Get paid amount for the holder
     */
    async getHolderPaidAmount(offerId, holderIdentity) {
        this.log.trace(`getHolderPaidAmount(offer=${offerId}, holderIdentity=${holderIdentity})`);
        return this.holdingStorageContract.methods
            .getHolderPaidAmount(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }
}

module.exports = Ethereum;
