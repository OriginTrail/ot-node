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
            this.blockchain = new Ethereum(this.config, this.emitter, this.web3, this.log);
            break;
        default:
            this.log.error('Unsupported blockchain', this.config.blockchain_title);
        }
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
     * Writes data import root hash on blockchain
     * @param importId
     * @param rootHash
     * @param importHash
     * @returns {Promise}
     */
    writeRootHash(importId, rootHash, importHash) {
        return this.blockchain.writeRootHash(importId, rootHash, importHash);
    }

    /**
     * Gets profile by wallet
     * @param wallet
     */
    getProfile(wallet) {
        return this.blockchain.getProfile(wallet);
    }

    /**
     * Get offer by importId
     * @param importId
     * @returns {Promise}
     */
    getOffer(importId) {
        return this.blockchain.getOffer(importId);
    }

    /**
     * Gets the index of the node's bid in the array of one offer
     * @param importId Offer import id
     * @param dhNodeId KADemplia ID of the DH node that wants to get index
     * @returns {Promisse<any>} integer index in the array
     */
    getBidIndex(importId, nodeId) {
        return this.blockchain.getBidIndex(importId, nodeId);
    }

    /**
     * Creates node profile on the Bidding contract
     * @param nodeId        Kademlia node ID
     * @param pricePerByteMinute Price for byte per minute
     * @param stakePerByteMinute Stake for byte per minute
     * @param readStakeFactor Read stake factor
     * @param maxTimeMins   Max time in minutes
     * @return {Promise<any>}
     */
    createProfile(
        nodeId, pricePerByteMinute, stakePerByteMinute,
        readStakeFactor, maxTimeMins,
    ) {
        return this.blockchain.createProfile(
            nodeId, pricePerByteMinute, stakePerByteMinute,
            readStakeFactor, maxTimeMins,
        );
    }

    /**
     * Increase token approval for escrow contract
     * @param {number} tokenAmountIncrease
     * @returns {Promise}
     */
    increaseApproval(tokenAmountIncrease) {
        return this.blockchain.increaseApproval(tokenAmountIncrease);
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
     * Verify escrow contract
     * @param importId
     * @param dhWallet
     * @returns {Promise}
     */
    verifyEscrow(importId, dhWallet) {
        return this.blockchain.verifyEscrow(importId, dhWallet);
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
     * Cancel data holding escrow process
     * @param {string} - dhWallet
     * @param {number} - importId
     * @returns {Promise}
     */
    cancelEscrow(dhWallet, importId, dhIsSender) {
        return this.blockchain.cancelEscrow(dhWallet, importId, dhIsSender);
    }

    /**
     * Pay out tokens from escrow
     * @param {string} - dcWallet
     * @param {number} - importId
     * @returns {Promise}
     */
    payOut(dcWallet, importId) {
        return this.blockchain.payOut(dcWallet, importId);
    }

    /**
     * Creates offer for the data storing on the Ethereum blockchain.
     * @param importId Import ID of the offer.
     * @param nodeId KADemlia node ID of offer creator
     * @param totalEscrowTime Total time of the escrow in milliseconds
     * @param maxTokenAmount Maximum price per DH
     * @param MinStakeAmount Minimum stake in tokens
     * @param minReputation Minimum required reputation
     * @param dataHash Hash of the data put to the offer
     * @param dataSize Size of the data for storing in bytes
     * @param predeterminedDhWallets Array of predetermined DH wallets to be used in offer
     * @param predeterminedDhNodeIds Array of predetermined node IDs to be used in offer
     * @returns {Promise<any>} Return choose start-time.
     */
    createOffer(
        importId, nodeId,
        totalEscrowTime,
        maxTokenAmount,
        MinStakeAmount,
        minReputation,
        dataHash,
        dataSize,
        predeterminedDhWallets,
        predeterminedDhNodeIds,
    ) {
        return this.blockchain.createOffer(
            importId, nodeId,
            totalEscrowTime,
            maxTokenAmount,
            MinStakeAmount,
            minReputation,
            dataHash,
            dataSize,
            predeterminedDhWallets,
            predeterminedDhNodeIds,
        );
    }

    /**
     * Cancel offer for data storing on Ethereum blockchain.
     * @param importId Data if of the offer.
     */
    cancelOffer(importId) {
        return this.blockchain.cancelOffer(importId);
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
    subscribeToEventPermanent(event) {
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
     * Activates predetermined bid to the offer on Ethereum blockchain
     * @param importId Import ID
     * @param dhNodeId KADemlia ID of the DH node that wants to activate bid
     * @param bidIndex index of the bid
     * @returns {Promise<any>} Index of the bid.
     */
    activatePredeterminedBid(importId, dhNodeId, bidIndex) {
        return this.blockchain.activatePredeterminedBid(importId, dhNodeId, bidIndex);
    }

    /**
     * Cancel the bid on Ethereum blockchain
     * @param dcWallet Wallet of the bidder
     * @param importId ID of the data of the bid
     * @param bidIndex Index of the bid
     * @returns {Promise<any>}
     */
    cancelBid(dcWallet, importId, bidIndex) {
        return this.blockchain.cancelBid(dcWallet, importId, bidIndex);
    }

    /**
     * Starts choosing bids from contract escrow on Ethereum blockchain
     * @param importId Import ID
     * @returns {Promise<any>} Array of bid indices of chosen ones.
     */
    chooseBids(importId) {
        return this.blockchain.chooseBids(importId);
    }

    /**
     *
     * @param dcWallet
     * @param importId
     * @param bidIndex
     * @returns {Promise<any>}
     */
    getBid(dcWallet, importId, bidIndex) {
        return this.blockchain.getBid(dcWallet, importId, bidIndex);
    }

    /**
    * Gets status of the offer
    * @param importId
    * @return {Promise<any>}
    */
    getOfferStatus(importId) {
        return this.blockchain.getOfferStatus(importId);
    }

    getDcWalletFromOffer(importId) {
        return this.blockchain.getDcWalletFromOffer(importId);
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
     * @param amount
     * @returns {Promise<any>}
     */
    async depositToken(amount) {
        return this.blockchain.depositToken(amount);
    }

    /**
     * Withdraws tokens from profile to wallet
     * @param amount
     * @returns {Promise<any>}
     */
    async withdrawToken(amount) {
        return this.blockchain.withdrawToken(amount);
    }

    async getRootHash(dcWallet, dataId) {
        return this.blockchain.getRootHash(dcWallet, dataId);
    }

    async addRootHashAndChecksum(importId, litigationHash, distributionHash, checksum) {
        return this.blockchain.addRootHashAndChecksum(
            importId,
            litigationHash,
            distributionHash,
            checksum,
        );
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
     * Get replication modifier
     */
    async getReplicationModifier() {
        return this.blockchain.getReplicationModifier();
    }
}

module.exports = Blockchain;
