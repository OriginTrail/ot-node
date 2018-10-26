const Ethereum = require('./Blockchain/Ethereum/index.js');

class Blockchain {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.config = ctx.config.blockchain;
        this.emitter = ctx.emitter;
        this.web3 = ctx.web3;
        this.log = ctx.logger;

        switch (this.config.blockchain_title) {
        case 'Ethereum':
            this.blockchain = new Ethereum(ctx);
            break;
        default:
            this.log.error('Unsupported blockchain', this.config.blockchain_title);
        }
    }

    /**
     * Initialize Blockchain provider
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.blockchain.initialize();
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
     * @param profileNodeId - Network node ID
     * @param initialBalance - Initial profile balance
     * @param isSender725 - Is sender ERC 725?
     * @param blockchainIdentity - ERC 725 identity (empty if there is none)
     * @return {Promise<any>}
     */
    createProfile(profileNodeId, initialBalance, isSender725, blockchainIdentity) {
        return this.blockchain.createProfile(profileNodeId, initialBalance, isSender725);
    }

    /**
     * Gets minimum stake for creating a profile
     * @returns {Promise<*>}
     */
    async getProfileMinimumStake() {
        return this.blockchain.getProfileMinimumStake();
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
     * DC initiates litigation on DH wrong challenge answer
     * @param importId
     * @param dhWallet
     * @param blockId
     * @param merkleProof
     * @return {Promise<any>}
     */
    initiateLitigation(importId, dhWallet, blockId, merkleProof) {
        return this.blockchain.initiateLitigation(importId, dhWallet, blockId, merkleProof);
    }

    /**
     * Answers litigation from DH side
     * @param importId
     * @param requestedData
     * @return {Promise<any>}
     */
    answerLitigation(importId, requestedData) {
        return this.blockchain.answerLitigation(importId, requestedData);
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
    * Gets status of the offer
    * @param importId
    * @return {Promise<any>}
    */
    getOfferStatus(importId) {
        return this.blockchain.getOfferStatus(importId);
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
     * Get all approved nodes
     */
    async getApprovedNodes() {
        return this.blockchain.getApprovedNodes();
    }

    async getBalances() {
        return this.blockchain.getBalances();
    }
}

module.exports = Blockchain;
