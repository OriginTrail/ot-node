const fs = require('fs');
const BN = require('bn.js');
const uuidv4 = require('uuid/v4');
const ethereumAbi = require('ethereumjs-abi');
const Op = require('sequelize/lib/operators');

const Transactions = require('./Transactions');
const Utilities = require('../../Utilities');
const Models = require('../../../models');

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
        pricingService,
    }) {
        // Loading Web3
        this.appState = appState;
        this.emitter = emitter;
        this.web3 = web3;
        this.logger = logger;
        this.pricingService = pricingService;

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

        this.logger.info('Selected blockchain: Ethereum');

        this.initalized = false;
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
        const oldHoldingAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/old-holding.json');
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

        // Marketplace contract data
        const marketplaceAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/marketplace.json');
        this.marketplaceContractAddress = await this._getMarketplaceContractAddress();
        this.marketplaceContractAbi = JSON.parse(marketplaceAbiFile);
        this.marketplaceContract = new this.web3.eth.Contract(
            this.marketplaceContractAbi,
            this.marketplaceContractAddress,
        );

        // Marketplace storage contract data
        const marketplaceStorageAbiFile = fs.readFileSync('./modules/Blockchain/Ethereum/abi/marketplace-storage.json');
        this.marketplaceStorageContractAddress = await this._getMarketplaceStorageContractAddress();
        this.marketplaceStorageContractAbi = JSON.parse(marketplaceStorageAbiFile);
        this.marketplaceStorageContract = new this.web3.eth.Contract(
            this.marketplaceStorageContractAbi,
            this.marketplaceStorageContractAddress,
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
            HUB_CONTRACT: this.hubContract,
            HOLDING_CONTRACT: this.holdingContract,
            OLD_HOLDING_CONTRACT: this.oldHoldingContract, // TODO remove after successful migration
            PROFILE_CONTRACT: this.profileContract,
            APPROVAL_CONTRACT: this.approvalContract,
            LITIGATION_CONTRACT: this.litigationContract,
            MARKETPLACE_CONTRACT: this.marketplaceContract,
            REPLACEMENT_CONTRACT: this.replacementContract,
        };

        this.logger.info('Smart contract instances initialized.');

        if (!this.initalized) {
            this.initalized = true;
            this.subscribeToEventPermanentWithCallback([
                'ContractsChanged',
            ], async (eventData) => {
                this.logger.notify('Contracts changed, refreshing information.');
                await this.initialize();
            });
        }
    }

    /**
     * Gets Holding contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getHoldingContractAddress() {
        this.logger.trace('Asking Hub for Holding contract address...');
        const address = await this.hubContract.methods.getContractAddress('Holding').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Holding contract address is ${address}`);
        return address;
    }

    /**
     * Gets old Holding contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getOldHoldingContractAddress() {
        this.logger.trace('Asking Hub for old Holding contract address...');
        const address = await this.hubContract.methods.getContractAddress('OldHolding').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Old Holding contract address is ${address}`);
        return address;
    }

    /**
     * Gets Token contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getTokenContractAddress() {
        this.logger.trace('Asking Hub for Token contract address...');
        const address = await this.hubContract.methods.getContractAddress('Token').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Token contract address is ${address}`);
        return address;
    }

    /**
     * Gets Reading contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getReadingContractAddress() {
        this.logger.trace('Asking Hub for Reading contract address...');
        const address = await this.hubContract.methods.getContractAddress('Reading').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Reading contract address is ${address}`);
        return address;
    }

    /**
     * Gets Profile contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getProfileContractAddress() {
        this.logger.trace('Asking Hub for Profile contract address...');
        const address = await this.hubContract.methods.getContractAddress('Profile').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Profile contract address is ${address}`);
        return address;
    }

    /**
     * Gets Approval contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getApprovalContractAddress() {
        this.logger.trace('Asking Hub for Approval contract address...');
        const address = await this.hubContract.methods.getContractAddress('Approval').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Approval contract address is ${address}`);
        return address;
    }

    /**
     * Gets Profile storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getProfileStorageContractAddress() {
        this.logger.trace('Asking Hub for ProfileStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('ProfileStorage').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`ProfileStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets Holding storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getHoldingStorageContractAddress() {
        this.logger.trace('Asking Hub for HoldingStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('HoldingStorage').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`HoldingStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets old Holding storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getOldHoldingStorageContractAddress() {
        this.logger.trace('Asking Hub for old HoldingStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('OldHoldingStorage').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Old HoldingStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets Litigation contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getLitigationContractAddress() {
        this.logger.trace('Asking Hub for Litigation contract address...');
        const address = await this.hubContract.methods.getContractAddress('Litigation').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Litigation contract address is ${address}`);
        return address;
    }

    /**
     * Gets Marketplace contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getMarketplaceContractAddress() {
        this.logger.trace('Asking Hub for Marketplace contract address...');
        const address = await this.hubContract.methods.getContractAddress('Marketplace').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Marketplace contract address is ${address}`);
        return address;
    }

    /**
     * Gets Replacement contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getReplacementContractAddress() {
        this.logger.trace('Asking Hub for Replacement contract address...');
        const address = await this.hubContract.methods.getContractAddress('Replacement').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`Replacement contract address is ${address}`);
        return address;
    }

    /**
     * Gets Litigation storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getLitigationStorageContractAddress() {
        this.logger.trace('Asking Hub for LitigationStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('LitigationStorage').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`LitigationStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets Marketplace storage contract address from Hub
     * @returns {Promise<any>}
     * @private
     */
    async _getMarketplaceStorageContractAddress() {
        this.logger.trace('Asking Hub for MarketplaceStorage contract address...');
        const address = await this.hubContract.methods.getContractAddress('MarketplaceStorage').call({
            from: this.config.wallet_address,
        });
        this.logger.trace(`MarketplaceStorage contract address is ${address}`);
        return address;
    }

    /**
     * Gets root hash for import
     * @param dataSetId Data set ID
     * @return {Promise<any>}
     */
    async getRootHash(dataSetId) {
        this.logger.trace(`Fetching root hash for data set ${dataSetId}`);
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
            this.logger.trace(`Getting profile balance by wallet ${wallet}`);
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
    async createProfile(
        managementWallet,
        profileNodeId,
        initialBalance,
        isSender725,
        blockchainIdentity,
    ) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.profileContractAddress,
        };
        this.logger.trace(`CreateProfile(${managementWallet}, ${profileNodeId}, ${initialBalance}, ${isSender725}, ${blockchainIdentity})`);
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
    async increaseProfileApproval(tokenAmountIncrease) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.tokenContractAddress,
        };
        this.logger.trace(`increaseProfileApproval(amount=${tokenAmountIncrease})`);
        return this.transactions.queueTransaction(this.tokenContractAbi, 'increaseApproval', [this.profileContractAddress, tokenAmountIncrease], options);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @param amount
     * @return {Promise<any>}
     */
    async startTokenWithdrawal(blockchainIdentity, amount) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.profileContractAddress,
        };
        this.logger.trace(`startTokenWithdrawal(blockchainIdentity=${blockchainIdentity}, amount=${amount}`);
        return this.transactions.queueTransaction(this.profileContractAbi, 'startTokenWithdrawal', [blockchainIdentity, amount], options);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @return {Promise<any>}
     */
    async withdrawTokens(blockchainIdentity) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.profileContractAddress,
        };
        this.logger.trace(`withdrawTokens(blockchainIdentity=${blockchainIdentity}`);
        return this.transactions.queueTransaction(this.profileContractAbi, 'withdrawTokens', [blockchainIdentity], options);
    }

    /**
     * Answers litigation from DH side
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param answer - Litigation answer
     * @param urgent - Whether maximum gas price should be used
     * @return {Promise<any>}
     */
    async answerLitigation(offerId, holderIdentity, answer, urgent) {
        const gasPrice = await this.getGasPrice(urgent);
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.litigationContractAddress,
        };
        this.logger.trace(`answerLitigation (offerId=${offerId}, holderIdentity=${holderIdentity}, answer=${answer})`);
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
     * Pay out tokens
     * @param blockchainIdentity
     * @param offerId
     * @param urgent
     * @returns {Promise}
     */
    async payOut(blockchainIdentity, offerId, urgent) {
        let contractAddress = this.holdingContractAddress;

        const offer = await this.getOffer(offerId);
        if (Utilities.isZeroHash(offer['0'])) {
            contractAddress = this.oldHoldingContractAddress;
        }
        const gasPrice = await this.getGasPrice(urgent);
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: contractAddress,
        };
        this.logger.trace(`payOut(blockchainIdentity=${blockchainIdentity}, offerId=${offerId}`);
        return this.transactions.queueTransaction(this.holdingContractAbi, 'payOut', [blockchainIdentity, offerId], options);
    }

    /**
     * PayOut for multiple offers.
     * @returns {Promise<any>}
     */
    async payOutMultiple(
        blockchainIdentity,
        offerIds,
    ) {
        const gasLimit = offerIds.length * 200000;
        const gasPrice = await this.getGasPrice(true);
        const options = {
            gasLimit: this.web3.utils.toHex(gasLimit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.oldHoldingContractAddress,
        };
        this.logger.trace(`payOutMultiple (identity=${blockchainIdentity}, offerIds=${offerIds}`);
        return this.transactions.queueTransaction(
            this.oldHoldingContractAbi, 'payOutMultiple',
            [
                blockchainIdentity,
                offerIds,
            ],
            options,
        );
    }

    /**
     * Creates offer for the data storing on the Ethereum blockchain.
     * @returns {Promise<any>} Return choose start-time.
     */
    async createOffer(
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
        const gasPrice = await this.getGasPrice(urgent);
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.holdingContractAddress,
        };
        this.logger.trace(`createOffer (${blockchainIdentity}, ${dataSetId}, ${dataRootHash}, ${redLitigationHash}, ${greenLitigationHash}, ${blueLitigationHash}, ${dcNodeId}, ${holdingTimeInMinutes}, ${tokenAmountPerHolder}, ${dataSizeInBytes}, ${litigationIntervalInMinutes})`);
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
        parentIdentity,
        urgent,
    ) {
        let contractAddress = this.holdingContractAddress;

        const offer = await this.getOffer(offerId);
        if (Utilities.isZeroHash(offer['0'])) {
            contractAddress = this.oldHoldingContractAddress;
        }
        const gasPrice = await this.getGasPrice(urgent);
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: contractAddress,
        };

        this.logger.trace(`finalizeOffer (${blockchainIdentity}, ${offerId}, ${shift}, ${confirmation1}, ${confirmation2}, ${confirmation3}, ${encryptionType}, ${holders}), ${parentIdentity}`);
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
                parentIdentity,
            ],
            options,
        );
    }

    /**
     * Replaces holder
     * @returns {Promise<any>}
     */
    async replaceHolder(
        offerId,
        holderIdentity,
        litigatorIdentity,
        shift,
        confirmation1,
        confirmation2,
        confirmation3,
        holders,
    ) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.replacementContractAddress,
        };

        this.logger.trace(`replaceHolder (${offerId}, ${holderIdentity}, ${litigatorIdentity}, ${shift}, ${confirmation1}, ${confirmation2}, ${confirmation3}, ${holders})`);
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
     * Gets the current block if one wasn't retrieved in the last 10 seconds
     * @returns {int}
     */
    async getCurrentBlock() {
        const timeout = 10000;
        if (this.lastBlockCheck == null || this.lastBlockCheck + timeout < Date.now()) {
            this.lastBlock = await this.web3.eth.getBlockNumber();
            this.lastBlockCheck = Date.now();
        }

        return this.lastBlock;
    }

    /**
     * Gets all past events for the contract
     * @param contractName
     */
    async getAllPastEvents(contractName) {
        try {
            const currentBlock = await this.getCurrentBlock();

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

            const contract = this.contractsByName[contractName];
            if (Utilities.isZeroHash(contract._address)) {
                return;
            }
            const events = await contract.getPastEvents('allEvents', {
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
                this.logger.warn('Node failed to communicate with blockchain provider. Check internet connection');
            } else {
                this.logger.trace(`Failed to get all passed events. ${error}.`);
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
     * @param emitCallback function to be executed
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
                        this.logger.error(error);
                    }
                });
            }
        }, 2000);

        return handle;
    }

    /**
     * Deposit tokens to profile
     * @param blockchainIdentity
     * @param amount
     * @returns {Promise<any>}
     */
    async depositTokens(blockchainIdentity, amount) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.profileContractAddress,
        };

        this.logger.trace(`Calling - depositToken(${amount.toString()})`);
        return this.transactions.queueTransaction(
            this.profileContractAbi, 'depositTokens',
            [blockchainIdentity, amount], options,
        );
    }

    async getPurchase(purchaseId) {
        this.logger.trace(`Asking for purchase with id [${purchaseId}].`);
        return this.marketplaceStorageContract.methods.purchase(purchaseId).call();
    }

    async getPurchaseStatus(purchaseId) {
        this.logger.trace(`Asking for purchase with id [${purchaseId}].`);
        return this.marketplaceStorageContract.methods.getStage(purchaseId).call();
    }

    async getPurchasedData(importId, wallet) {
        this.logger.trace(`Asking purchased data for import ${importId} and wallet ${wallet}.`);
        return this.readingContract.methods.purchased_data(importId, wallet).call();
    }

    async getPaymentStageInterval() {
        this.logger.trace('Reading payment stage interval from blockchain.');
        return this.marketplaceContract.methods.paymentStageInterval().call();
    }


    async initiatePurchase(
        sellerIdentity, buyerIdentity,
        tokenAmount,
        originalDataRootHash, encodedDataRootHash,
    ) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.marketplaceContractAddress,
        };

        this.logger.trace(`initiatePurchase (${sellerIdentity}, ${buyerIdentity}, ${tokenAmount}, ${originalDataRootHash}, ${encodedDataRootHash})`);
        return this.transactions.queueTransaction(
            this.marketplaceContractAbi, 'initiatePurchase',
            [
                sellerIdentity,
                buyerIdentity,
                tokenAmount,
                originalDataRootHash,
                encodedDataRootHash,
            ], options,
        );
    }

    /**
     * Decodes offer task event data from offer creation event
     * @param result Blockchain transaction receipt
     * @returns {Object<any>}
     */
    decodePurchaseInitiatedEventFromTransaction(result) {
        let purchaseInitiatedEventInputs;
        const purchaseInitiatedEventAbi = this.marketplaceContractAbi.find(element => element.name === 'PurchaseInitiated');
        if (purchaseInitiatedEventAbi) {
            purchaseInitiatedEventInputs = purchaseInitiatedEventAbi.inputs;
        } else {
            throw Error('Could not find OfferTask event interface in Holding contract abi');
        }

        return this.web3.eth.abi.decodeLog(
            purchaseInitiatedEventInputs,
            result.logs[0].data,
            result.logs[0].topics,
        );
    }

    async depositKey(purchaseId, key) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.marketplaceContractAddress,
        };

        this.logger.trace(`depositKey(${purchaseId}, ${key})`);
        return this.transactions.queueTransaction(
            this.marketplaceContractAbi, 'depositKey',
            [purchaseId, key], options,
        );
    }

    async takePayment(purchaseId) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.marketplaceContractAddress,
        };

        this.logger.trace(`takePayment(${purchaseId})`);
        return this.transactions.queueTransaction(
            this.marketplaceContractAbi, 'takePayment',
            [purchaseId], options,
        );
    }

    async complainAboutNode(
        purchaseId, outputIndex, inputIndexLeft, encodedOutput, encodedInputLeft,
        proofOfEncodedOutput, proofOfEncodedInputLeft,
    ) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.marketplaceContractAddress,
        };

        this.logger.trace(`complainAboutNode(${purchaseId},${outputIndex},${inputIndexLeft},` +
        `${encodedOutput},${encodedInputLeft},${proofOfEncodedOutput},${proofOfEncodedInputLeft})`);
        return this.transactions.queueTransaction(
            this.marketplaceContractAbi, 'complainAboutNode',
            [purchaseId, outputIndex, inputIndexLeft, encodedOutput, encodedInputLeft,
                proofOfEncodedOutput, proofOfEncodedInputLeft], options,
        );
    }

    async complainAboutRoot(purchaseId, encodedRootHash, proofOfEncodedRootHash, rootHashIndex) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.marketplaceContractAddress,
        };

        this.logger.trace(`complainAboutRoot(${purchaseId},${encodedRootHash},${proofOfEncodedRootHash},${rootHashIndex})`);
        return this.transactions.queueTransaction(
            this.marketplaceContractAbi, 'complainAboutRoot',
            [purchaseId, encodedRootHash, proofOfEncodedRootHash, rootHashIndex], options,
        );
    }

    async sendCommitment(importId, dvWallet, commitment) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.readingContractAddress,
        };

        this.logger.trace(`sendCommitment (${importId}, ${dvWallet}, ${commitment})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendCommitment',
            [importId, dvWallet, commitment], options,
        );
    }

    async initiateDispute(importId, dhWallet) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.readingContractAddress,
        };

        this.logger.trace(`initiateDispute (${importId}, ${dhWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'initiateDispute',
            [importId, dhWallet], options,
        );
    }

    async confirmPurchase(importId, dhWallet) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.readingContractAddress,
        };

        this.logger.trace(`confirmPurchase (${importId}, ${dhWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'confirmPurchase',
            [importId, dhWallet], options,
        );
    }

    async cancelPurchase(importId, correspondentWallet, senderIsDh) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.readingContractAddress,
        };

        this.logger.trace(`confirmPurchase (${importId}, ${correspondentWallet}, ${senderIsDh})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'confirmPurchase',
            [importId, correspondentWallet, senderIsDh], options,
        );
    }

    async sendProofData(
        importId, dvWallet, checksumLeft, checksumRight, checksumHash,
        randomNumber1, randomNumber2, decryptionKey, blockIndex,
    ) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.readingContractAddress,
        };

        this.logger.trace(`sendProofData (${importId} ${dvWallet} ${checksumLeft} ${checksumRight} ${checksumHash}, ${randomNumber1}, ${randomNumber2} ${decryptionKey} ${blockIndex})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendProofData',
            [
                importId, dvWallet, checksumLeft, checksumRight, checksumHash,
                randomNumber1, randomNumber2, decryptionKey, blockIndex,
            ], options,
        );
    }

    async sendEncryptedBlock(importId, dvWallet, encryptedBlock) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.readingContractAddress,
        };

        this.logger.trace(`sendEncryptedBlock (${importId}, ${dvWallet}, ${encryptedBlock})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'sendEncryptedBlock',
            [importId, dvWallet, encryptedBlock], options,
        );
    }

    async payOutForReading(importId, dvWallet, urgent) {
        const gasPrice = await this.getGasPrice(urgent);
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.readingContractAddress,
        };

        this.logger.trace(`payOutForReading (${importId}, ${dvWallet})`);
        return this.transactions.queueTransaction(
            this.readingContractAbi, 'payOut',
            [importId, dvWallet], options,
        );
    }

    /**
     * Get Profile minimum stake
     */
    async getProfileMinimumStake() {
        this.logger.trace('Get minimum stake from blockchain');
        return this.profileContract.methods.minimalStake().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get withdrawal time
     * @return {Promise<any>}
     */
    async getProfileWithdrawalTime() {
        this.logger.trace('Get withdrawal time from blockchain');
        return this.profileContract.methods.withdrawalTime().call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get profile by wallet
     * @param identity
     */
    async getProfile(identity) {
        this.logger.trace(`Get profile by identity ${identity}`);
        return this.profileStorageContract.methods.profile(identity).call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Set node ID
     * @param identity
     * @param nodeId
     */
    async setNodeId(identity, nodeId) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.profileContractAddress,
        };

        this.logger.trace(`Calling - setNodeId(${identity}, ${nodeId})`);
        return this.transactions.queueTransaction(
            this.profileContractAbi, 'setNodeId',
            [identity, nodeId], options,
        );
    }

    /**
     * Get difficulty for the particular offer
     */
    async getOfferDifficulty(offerId) {
        this.logger.trace(`getOfferDifficulty(offer=${offerId})`);
        return this.holdingStorageContract.methods.getOfferDifficulty(offerId).call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get all nodes which were added in the approval array
     */
    async getAddedNodes() {
        this.logger.trace('getAllNodes()');
        return this.approvalContract.methods.getAllNodes().call();
    }

    /**
     * Get the statuses of all nodes which were added in the approval array
     */
    async getNodeStatuses() {
        this.logger.trace('getNodeStatuses()');
        return this.approvalContract.methods.getNodeStatuses().call();
    }

    /**
     * Check if a specific node still has approval
     * @param nodeId
     */
    async nodeHasApproval(nodeId) {
        nodeId = Utilities.normalizeHex(nodeId);
        this.logger.trace(`nodeHasApproval(${nodeId})`);
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
    async transferProfile(erc725identity, managementWallet) {
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.profileContractAddress,
        };

        this.logger.trace(`transferProfile (${erc725identity}, ${managementWallet})`);
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
        this.logger.trace(`getOffer(offerId=${offerId})`);
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
        this.logger.trace(`getHolder(offerId=${offerId}, holderIdentity=${holderIdentity})`);
        return this.holdingStorageContract.methods.holder(offerId, holderIdentity).call({
            from: this.config.wallet_address,
        });
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
        const gasPrice = await this.getGasPrice();
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.litigationContractAddress,
        };

        this.logger.trace(`initiateLitigation (offerId=${offerId}, holderIdentity=${holderIdentity}, litigatorIdentity=${litigatorIdentity}, requestedObjectIndex=${requestedObjectIndex}, requestedBlockIndex=${requestedBlockIndex}, hashArray=${hashArray})`);
        return this.transactions.queueTransaction(
            this.litigationContractAbi, 'initiateLitigation',
            [
                offerId,
                holderIdentity,
                litigatorIdentity,
                requestedObjectIndex,
                requestedBlockIndex,
                hashArray,
            ], options,
        );
    }

    /**
     * Completes litigation for the particular DH
     * @param offerId - Offer ID
     * @param holderIdentity - DH identity
     * @param challengerIdentity - DC identity
     * @param proofData - answer
     * @param leafIndex - the number of the block in the lowest level of the merkle tree
     * @param urgent - Whether max gas price should be used or not
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
        const gasPrice = await this.getGasPrice(urgent);
        const options = {
            gasLimit: this.web3.utils.toHex(this.config.gas_limit),
            gasPrice: this.web3.utils.toHex(gasPrice),
            to: this.litigationContractAddress,
        };

        this.logger.trace(`completeLitigation (offerId=${offerId}, holderIdentity=${holderIdentity}, challengerIdentity=${challengerIdentity}, proofData=${proofData}, leafIndex=${leafIndex})`);
        return this.transactions.queueTransaction(
            this.litigationContractAbi, 'completeLitigation',
            [offerId, holderIdentity, challengerIdentity, proofData, leafIndex], options,
        );
    }

    /**
     * Gets litigation information for the holder
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigation(offerId, holderIdentity) {
        this.logger.trace(`getLitigation(offerId=${offerId}, holderIdentity=${holderIdentity})`);
        return this.litigationStorageContract
            .methods.litigation(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Gets last litigation timestamp for the holder
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationTimestamp(offerId, holderIdentity) {
        this.logger.trace(`getLitigationTimestamp(offerId=${offerId}, holderIdentity=${holderIdentity})`);
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
        this.logger.trace(`getLitigationDifficulty(offerId=${offerId}, holderIdentity=${holderIdentity})`);
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
        this.logger.trace(`getLitigationReplacementTask(offerId=${offerId}, holderIdentity=${holderIdentity})`);
        return this.litigationStorageContract
            .methods.getLitigationReplacementTask(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Get staked amount for the holder
     */
    async getHolderStakedAmount(offerId, holderIdentity) {
        this.logger.trace(`getHolderStakedAmount(offer=${offerId}, holderIdentity=${holderIdentity})`);
        return this.holdingStorageContract.methods
            .getHolderStakedAmount(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Get paid amount for the holder
     */
    async getHolderPaidAmount(offerId, holderIdentity) {
        this.logger.trace(`getHolderPaidAmount(offer=${offerId}, holderIdentity=${holderIdentity})`);
        return this.holdingStorageContract.methods
            .getHolderPaidAmount(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    /**
     * Check that the identity key has a specific purpose
     * @param identity - ERC-725 identity address
     * @param key - identity key
     * @param purpose - purpose to verify
     * @return {Promise<any>}
     */
    async keyHasPurpose(identity, key, purpose) {
        // Get contract instance
        const identityContract = new this.web3.eth.Contract(
            this.erc725IdentityContractAbi,
            identity,
        );

        key = Utilities.normalizeHex(key);

        this.logger.trace(`identity=${identity} keyHasPurpose(key=${key}, purpose=${purpose.toString()})`);

        return identityContract.methods.keyHasPurpose(key, purpose).call({
            from: this.config.wallet_address,
        });
    }

    /**
     * Get litigation encryption type
     */
    async getHolderLitigationEncryptionType(offerId, holderIdentity) {
        this.logger.trace(`getHolderLitigationEncryptionType(offer=${offerId}, holderIdentity=${holderIdentity})`);
        return this.holdingStorageContract.methods
            .getHolderLitigationEncryptionType(offerId, holderIdentity).call({
                from: this.config.wallet_address,
            });
    }

    async getTotalPayouts(identity) {
        const totalAmount = new BN(0);

        const events = await this.contractsByName.HOLDING_CONTRACT.getPastEvents('PaidOut', {
            fromBlock: 0,
            toBlock: 'latest',
        });
        events.forEach((event) => {
            if (Utilities.compareHexStrings(
                event.returnValues.holder,
                identity,
            )) {
                totalAmount.iadd(new BN(event.returnValues.amount));
            }
        });
        return totalAmount.toString();
    }

    /**
     * Returns gas price, throws error if not urgent and gas price higher than maximum allowed price
     * @param urgent
     * @returns {Promise<*|number>}
     */
    async getGasPrice(urgent = false) {
        const gasPrice = await this.pricingService.getGasPrice();
        if (gasPrice > this.config.max_allowed_gas_price && !urgent) {
            throw new Error('Gas price higher than maximum allowed price');
        } else {
            return gasPrice;
        }
    }

    numberOfEventsEmmitted(receipt) {
        if (!receipt || !receipt.logs || !Array.isArray(receipt.logs)) {
            return undefined;
        }
        return receipt.logs.length;
    }
}

module.exports = Ethereum;
