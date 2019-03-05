const Ethereum = require('./Blockchain/Ethereum/index.js');

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

        switch (this.config.blockchain_title) {
        case 'Ethereum':
            this.blockchain = new Ethereum(ctx);
            break;
        default:
            this.log.error('Unsupported blockchain', this.config.blockchain_title);
        }
        this.pluginService.bootstrap();
    }

    /**
     * Initialize Blockchain provider
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.blockchain.initialize();
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
     * Checks if the node would rank in the top n + 1 network bids.
     * @param importId Offer import id
     * @param wallet DH wallet
     * @param dhNodeId KADemplia ID of the DH node that wants to add bid
     * @returns {Promisse<any>} boolean whether node would rank in the top n + 1
     */
    getDistanceParameters(importId) {
        return this.blockchain.getDistanceParameters(importId);
    }

    /**
     * Gets profile by wallet
     * @param identity
     */
    getProfile(identity) {
        return this.blockchain.getProfile(identity);
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
        return this.blockchain.createProfile(
            managementWallet,
            profileNodeId, initialBalance, isSender725,
            blockchainIdentity,
        );
    }

    /**
     * Gets minimum stake for creating a profile
     * @returns {Promise<*>}
     */
    async getProfileMinimumStake() {
        return this.blockchain.getProfileMinimumStake();
    }

    /**
     * Gets withdrawal time
     * @return {Promise<*>}
     */
    async getProfileWithdrawalTime() {
        return this.blockchain.getProfileWithdrawalTime();
    }

    /**
     * Increase token approval for escrow contract
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseProfileApproval(tokenAmountIncrease) {
        return this.blockchain.increaseProfileApproval(tokenAmountIncrease);
    }

    /**
     * Increase token approval for bidding contract
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseBiddingApproval(tokenAmountIncrease) {
        return this.blockchain.increaseBiddingApproval(tokenAmountIncrease);
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
        return this.blockchain.initiateLitigation(
            offerId,
            holderIdentity, litigatorIdentity, requestedDataIndex, hashArray,
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
        return this.blockchain.completeLitigation(
            offerId, holderIdentity,
            challengerIdentity, proofData,
        );
    }

    /**
     * Answers litigation from DH side
     * @param offerId
     * @param holderIdentity
     * @param answer
     * @return {Promise<any>}
     */
    answerLitigation(offerId, holderIdentity, answer) {
        return this.blockchain.answerLitigation(offerId, holderIdentity, answer);
    }

    /**
     * Prooves litigation for particular DH
     * @param importId
     * @param dhWallet
     * @param proofData
     * @return {Promise<any>}
     */
    proveLitigation(importId, dhWallet, proofData) {
        return this.blockchain.proveLitigation(importId, dhWallet, proofData);
    }

    /**
     * Pay out tokens
     * @param blockchainIdentity
     * @param offerId
     * @returns {Promise}
     */
    payOut(blockchainIdentity, offerId) {
        return this.blockchain.payOut(blockchainIdentity, offerId);
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
        return this.blockchain.createOffer(
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
        return this.blockchain.finalizeOffer(
            blockchainIdentity, offerId, shift, confirmation1,
            confirmation2, confirmation3, encryptionType, holders,
        );
    }

    /**
     * Subscribe to a particular event
     * @param event
     * @param importId
     * @param endMs
     * @param endCallback
     * @param filterFn
     */
    subscribeToEvent(event, importId, endMs = 5 * 60 * 1000, endCallback, filterFn) {
        return this.blockchain
            .subscribeToEvent(event, importId, endMs, endCallback, filterFn);
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
        return this.blockchain.subscribeToEventPermanent(event);
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
    async subscribeToEventPermanentWithCallback(event, callback) {
        return this.blockchain.subscribeToEventPermanentWithCallback(event, callback);
    }

    /**
     * Gets all past events for the contract
     * @param contractName
     */
    getAllPastEvents(contractName) {
        return this.blockchain
            .getAllPastEvents(contractName);
    }

    async getStakedAmount(importId) {
        return this.blockchain.getStakedAmount(importId);
    }

    async getHoldingIncome(importId) {
        return this.blockchain.getHoldingIncome(importId);
    }

    async getPurchaseIncome(importId, dvWallet) {
        return this.blockchain.getPurchaseIncome(importId, dvWallet);
    }

    async getTotalStakedAmount() {
        return this.blockchain.getTotalStakedAmount();
    }

    async getTotalIncome() {
        return this.blockchain.getTotalIncome();
    }

    /**
     * Adds bid to the offer on Ethereum blockchain
     * @param importId Import ID
     * @param dhNodeId KADemlia ID of the DH node that wants to add bid
     * @returns {Promise<any>} Index of the bid.
     */
    addBid(importId, dhNodeId) {
        return this.blockchain.addBid(importId, dhNodeId);
    }

    /**
     * Gets balance from the profile
     * @param wallet
     * @returns {Promise}
     */
    getProfileBalance(wallet) {
        return this.blockchain.getProfileBalance(wallet);
    }

    /**
     * Deposits tokens to the profile
     * @param blockchainIdentity
     * @param amount
     * @returns {Promise<any>}
     */
    async depositTokens(blockchainIdentity, amount) {
        return this.blockchain.depositTokens(blockchainIdentity, amount);
    }

    /**
     * Gets root hash for import
     * @param dataSetId Data set ID
     * @return {Promise<any>}
     */
    async getRootHash(dataSetId) {
        return this.blockchain.getRootHash(dataSetId);
    }

    async getEscrow(importId, dhWallet) {
        return this.blockchain.getEscrow(importId, dhWallet);
    }

    async getPurchase(dhWallet, dvWallet, importId) {
        return this.blockchain.getPurchase(dhWallet, dvWallet, importId);
    }

    async getPurchasedData(importId, wallet) {
        return this.blockchain.getPurchasedData(importId, wallet);
    }

    async initiatePurchase(importId, dhWallet, tokenAmount, stakeFactor) {
        return this.blockchain.initiatePurchase(importId, dhWallet, tokenAmount, stakeFactor);
    }

    async sendCommitment(importId, dvWallet, commitment) {
        return this.blockchain.sendCommitment(importId, dvWallet, commitment);
    }

    async initiateDispute(importId, dhWallet) {
        return this.blockchain.initiateDispute(importId, dhWallet);
    }

    async confirmPurchase(importId, dhWallet) {
        return this.blockchain.confirmPurchase(importId, dhWallet);
    }

    async cancelPurchase(importId, correspondentWallet, senderIsDh) {
        return this.blockchain.cancelPurchase(importId, correspondentWallet, senderIsDh);
    }

    async sendProofData(
        importId, dvWallet, checksumLeft, checksumRight, checksumHash,
        randomNumber1, randomNumber2, decryptionKey, blockIndex,
    ) {
        return this.blockchain.sendProofData(
            importId, dvWallet, checksumLeft, checksumRight, checksumHash,
            randomNumber1, randomNumber2, decryptionKey, blockIndex,
        );
    }

    async sendEncryptedBlock(importId, dvWallet, encryptedBlock) {
        return this.blockchain.sendEncryptedBlock(importId, dvWallet, encryptedBlock);
    }

    /**
     * Pay out tokens from reading contract
     * @returns {Promise}
     * @param importId
     * @param dvWallet
     */
    async payOutForReading(importId, dvWallet) {
        return this.blockchain.payOutForReading(importId, dvWallet);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @param amount
     * @return {Promise<any>}
     */
    async startTokenWithdrawal(blockchainIdentity, amount) {
        return this.blockchain.startTokenWithdrawal(blockchainIdentity, amount);
    }

    /**
     * Start token withdrawal operation
     * @param blockchainIdentity
     * @return {Promise<any>}
     */
    async withdrawTokens(blockchainIdentity) {
        return this.blockchain.withdrawTokens(blockchainIdentity);
    }

    /**
     * Get difficulty for the particular offer
     */
    async getOfferDifficulty(offerId) {
        return this.blockchain.getOfferDifficulty(offerId);
    }

    /**
     * Get all nodes which were added in the approval array
     */
    async getAddedNodes() {
        return this.blockchain.getAddedNodes();
    }

    /**
     * Get the statuses of all nodes which were added in the approval array
     */
    async getNodeStatuses() {
        return this.blockchain.getNodeStatuses();
    }

    /**
     * Check if a specific node still has approval
     * @param nodeId
     */
    async nodeHasApproval(nodeId) {
        return this.blockchain.nodeHasApproval(nodeId);
    }

    /**
     * Token contract address getter
     * @return {any|*}
     */
    getTokenContractAddress() {
        return this.blockchain.getTokenContractAddress();
    }

    /**
     * Returns purposes of the wallet.
     * @param {string} - erc725Identity
     * @param {string} - wallet
     * @return {Promise<[]>}
     */
    getWalletPurposes(erc725Identity, wallet) {
        return this.blockchain.getWalletPurposes(erc725Identity, wallet);
    }

    /**
     * Transfers identity to new address.
     * @param {string} - erc725identity
     * @param {string} - managementWallet
     */
    transferProfile(erc725identity, managementWallet) {
        return this.blockchain.transferProfile(erc725identity, managementWallet);
    }

    /**
     * Returns true if ERC725 contract is older version.
     * @param {string} - address of ERC 725 identity.
     * @return {Promise<boolean>}
     */
    async isErc725IdentityOld(address) {
        return this.blockchain.isErc725IdentityOld(address);
    }

    /**
     * PayOut for multiple offers.
     * @returns {Promise<any>}
     */
    payOutMultiple(
        blockchainIdentity,
        offerIds,
    ) {
        return this.blockchain.payOutMultiple(
            blockchainIdentity,
            offerIds,
        );
    }

    /**
     * Get offer by ID
     * @param offerId - offer ID
     * @return {Promise<*>}
     */
    async getOffer(offerId) {
        return this.blockchain.getOffer(offerId);
    }

    /**
     * Get holders for offer ID
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getHolder(offerId, holderIdentity) {
        return this.blockchain.getHolder(offerId, holderIdentity);
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
        return this.blockchain.replaceHolder(
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
     * Gets last litigation timestamp for the holder
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationTimestamp(offerId, holderIdentity) {
        return this.blockchain.getLitigationTimestamp(offerId, holderIdentity);
    }

    /**
     * Gets last litigation difficulty
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationDifficulty(offerId, holderIdentity) {
        return this.blockchain.getLitigationDifficulty(offerId, holderIdentity);
    }

    /**
     * Gets last litigation replacement task
     * @param offerId - Offer ID
     * @param holderIdentity - Holder identity
     * @return {Promise<any>}
     */
    async getLitigationReplacementTask(offerId, holderIdentity) {
        return this.blockchain.getLitigationReplacementTask(offerId, holderIdentity);
    }

    /**
     * Get staked amount for the holder
     */
    async getHolderStakedAmount(offerId, holderIdentity) {
        return this.blockchain.getHolderStakedAmount(offerId, holderIdentity);
    }

    /**
     * Get paid amount for the holder
     */
    async getHolderPaidAmount(offerId, holderIdentity) {
        return this.blockchain.getHolderPaidAmount(offerId, holderIdentity);
    }
}

module.exports = Blockchain;
