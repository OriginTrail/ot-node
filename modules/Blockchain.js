const Utilities = require('./Utilities');
const Ethereum = require('./Blockchain/Ethereum/index.js');

const log = Utilities.getLogger();

class Blockchain {
    /**
     * Default constructor
     * @param ctx IoC context
     */
    constructor(ctx) {
        this.config = ctx.config.blockchain;
        this.emitter = ctx.emitter;
        this.web3 = ctx.web3;

        switch (this.config.blockchain_title) {
        case 'Ethereum':
            this.blockchain = new Ethereum(this.config, this.emitter, this.web3);
            break;
        default:
            log.error('Unsupported blockchain', this.config.blockchain_title);
        }
    }

    /**
     * Writes data import root hash on blockchain
     * @param dataId
     * @param rootHash
     * @returns {Promise}
     */
    writeRootHash(dataId, rootHash) {
        return this.blockchain.writeRootHash(dataId, rootHash);
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
     * Verify escrow contract contract data and start data holding process
     * @param {string} - dcWallet
     * @param {number} - dataId
     * @param {number} - tokenAmount
     * @param {number} - stakeAmount
     * @param {number} - totalTime
     * @returns {Promise}
     */
    verifyEscrow(dcWallet, dataId, tokenAmount, stakeAmount, totalTime) {
        return this.blockchain.verifyEscrow(dcWallet, dataId, tokenAmount, stakeAmount, totalTime);
    }

    /**
     * Cancel data holding escrow process
     * @param {string} - dhWallet
     * @param {number} - dataId
     * @returns {Promise}
     */
    cancelEscrow(dhWallet, dataId) {
        return this.blockchain.cancelEscrow(dhWallet, dataId);
    }

    /**
     * Pay out tokens from escrow
     * @param {string} - dcWallet
     * @param {number} - dataId
     * @returns {Promise}
     */
    payOut(dcWallet, dataId) {
        return this.blockchain.payOut(dcWallet, dataId);
    }

    /**
     * Creates offer for the data storing on the Ethereum blockchain.
     * @param dataId Data ID of the offer.
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
        dataId, nodeId,
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
            dataId, nodeId,
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
     * @param dataId Data if of the offer.
     */
    cancelOffer(dataId) {
        return this.blockchain.cancelOffer(dataId);
    }

    /**
    * Subscribe to a particular event
    * @param event
    * @param offerHash
    * @param endMs
    */
    subscribeToEvent(event, offerHash, endMs) {
        return this.blockchain
            .subscribeToEvent(event, offerHash, endMs);
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
     * @param offerHash Hash of the offer
     * @param dhNodeId KADemlia ID of the DH node that wants to add bid
     * @returns {Promise<any>} Index of the bid.
     */
    addBid(offerHash, dhNodeId) {
        return this.blockchain.addBid(offerHash, dhNodeId);
    }

    /**
     * Cancel the bid on Ethereum blockchain
     * @param dcWallet Wallet of the bidder
     * @param dataId ID of the data of the bid
     * @param bidIndex Index of the bid
     * @returns {Promise<any>}
     */
    cancelBid(dcWallet, dataId, bidIndex) {
        return this.blockchain.cancelBid(dcWallet, dataId, bidIndex);
    }

    /**
     * Starts choosing bids from contract escrow on Ethereum blockchain
     * @param offerHash Hash of the offer
     * @returns {Promise<any>} Array of bid indices of chosen ones.
     */
    chooseBids(offerHash) {
        return this.blockchain.chooseBids(offerHash);
    }

    /**
     *
     * @param dcWallet
     * @param dataId
     * @param bidIndex
     * @returns {Promise<any>}
     */
    getBid(dcWallet, dataId, bidIndex) {
        return this.blockchain.getBid(dcWallet, dataId, bidIndex);
    }

    /**
    * Gets status of the offer
    * @param dcWallet
    * @param dataId
    * @return {Promise<any>}
    */
    getOfferStatus(dcWallet, dataId) {
        return this.blockchain.getOfferStatus(dcWallet, dataId);
    }

    getDcWalletFromOffer(offer_hash) {
        return this.blockchain.getDcWalletFromOffer(offer_hash);
    }

    async depositToken(amount) {
        return this.blockchain.depositToken(amount);
    }

    async addRootHashAndChecksum(importId, litigationHash, distributionHash, checksum) {
        return this.blockchain.addRootHashAndChecksum(
            importId,
            litigationHash,
            distributionHash,
            checksum,
        );
    }
}

module.exports = Blockchain;
