const Utilities = require('./Utilities');
const Ethereum = require('./Blockchain/Ethereum/index.js');

const log = Utilities.getLogger();

class Blockchain {
    constructor(blockchainConfig) {
        this.config = blockchainConfig;
        switch (blockchainConfig.blockchain_title) {
        case 'Ethereum':
            this.blockchain = new Ethereum(blockchainConfig);
            break;
        default:
            log.error('Unsupported blockchain', blockchainConfig.blockchain_title);
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
    * @param dataId
    * @param endMs
    */
    subscribeToEvent(event, dataId, endMs) {
        return this.blockchain
            .subscribeToEvent(event, dataId, endMs);
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
     * @param dcWallet Wallet of the bidder
     * @param dataId ID of the data of the bid
     * @param nodeId KADemlia ID of this node
     * @param bidHash Hashed bid that will be revealed once
     * revealBid() is called. @note token amount cannot be greater then max token amount
     * @returns {Promise<any>} Index of the bid.
     */
    addBid(dcWallet, dataId, nodeId, bidHash) {
        return this.blockchain.addBid(dcWallet, dataId, nodeId, bidHash);
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
     * Reveals the bid of the offer
     * @param dcWallet Wallet of the DC who's offer is
     * @param dataId Id of the data in the offer
     * @param nodeId KADemlia ID of bidder
     * @param tokenAmount Amount of the token
     * @param stakeAmount Amount of the stake
     * @param bidIndex Index of the bid
     * @returns {Promise<any>}
     */
    revealBid(dcWallet, dataId, nodeId, tokenAmount, stakeAmount, bidIndex) {
        return this.blockchain.revealBid(
            dcWallet, dataId, nodeId,
            tokenAmount, stakeAmount, bidIndex,
        );
    }

    /**
     * Starts choosing bids from contract escrow on Ethereum blockchain
     * @param dataId ID of data of the bid
     * @returns {Promise<any>} Array of bid indices of chosen ones.
     */
    chooseBids(dataId) {
        return this.blockchain.chooseBids(dataId);
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
}

module.exports = Blockchain;
