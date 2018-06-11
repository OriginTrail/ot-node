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
            this.blockchain = new Ethereum(this.config, this.emitter, this.web3);
            break;
        default:
            this.log.error('Unsupported blockchain', this.config.blockchain_title);
        }
    }

    /**
     * Writes data import root hash on blockchain
     * @param importId
     * @param rootHash
     * @returns {Promise}
     */
    writeRootHash(importId, rootHash) {
        return this.blockchain.writeRootHash(importId, rootHash);
    }

    /**
     * Gets profile by wallet
     * @param wallet
     */
    getProfile(wallet) {
        return this.blockchain.getProfile(wallet);
    }

    /**
     * Creates node profile on the Bidding contract
     * @param nodeId        Kademlia node ID
     * @param pricePerByteMinute Price for byte per minute
     * @param stakePerByteMinute Stake for byte per minute
     * @param readStakeFactor Read stake factor
     * @param maxTimeMins   Max time in minutes
     * @param maxSizeBytes  Max size in bytes
     * @return {Promise<any>}
     */
    createProfile(
        nodeId, pricePerByteMinute, stakePerByteMinute,
        readStakeFactor, maxTimeMins, maxSizeBytes,
    ) {
        return this.blockchain.createProfile(
            nodeId, pricePerByteMinute, stakePerByteMinute,
            readStakeFactor, maxTimeMins, maxSizeBytes,
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
     * Cancel data holding escrow process
     * @param {string} - dhWallet
     * @param {number} - importId
     * @returns {Promise}
     */
    cancelEscrow(dhWallet, importId) {
        return this.blockchain.cancelEscrow(dhWallet, importId);
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
    */
    subscribeToEvent(event, importId, endMs) {
        return this.blockchain
            .subscribeToEvent(event, importId, endMs);
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
    * @param dcWallet
    * @param importId
    * @return {Promise<any>}
    */
    getOfferStatus(dcWallet, importId) {
        return this.blockchain.getOfferStatus(dcWallet, importId);
    }

    getDcWalletFromOffer(importId) {
        return this.blockchain.getDcWalletFromOffer(importId);
    }

    async depositToken(amount) {
        return this.blockchain.depositToken(amount);
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

    async getPurchaseData(wallet, importId) {
        return this.blockchain.getPurchaseData(wallet, importId);
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
}

module.exports = Blockchain;
