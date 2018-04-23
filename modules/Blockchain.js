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
        return this.blockchain.verifyEscrow(dcWallet, dataId, tokenAmount, totalTime);
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
     * @param biddingTime Total time of the bid in milliseconds
     * @param minNumberOfBids Number of bid required for offer to be successful
     * @param dataSize Size of the data for storing in bytes
     * @param ReplicationFactor Number of replications
     * @returns {Promise<any>} Return choose start-time.
     */
    createOffer(
        dataId, nodeId,
        totalEscrowTime,
        maxTokenAmount,
        MinStakeAmount,
        biddingTime,
        minNumberOfBids,
        dataSize, ReplicationFactor,
    ) {
        return this.blockchain.createOffer(
            dataId, nodeId,
            totalEscrowTime,
            maxTokenAmount,
            MinStakeAmount,
            biddingTime,
            minNumberOfBids,
            dataSize, ReplicationFactor,
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
     * @param contractName   Ethereum contract instance
     * @param event          Event name
     * @param eventOpts      Event options (filter, range, etc.)
     * @param callback       Callback to be executed on success/error (callback returns stop flag)
     * @param periodMills    Repeating period for checking past events
     * @param untilMills     Subscription termination
     */
    subscribeToEvent(contractName, event, eventOpts, callback, periodMills, untilMills)  {
        return this.blockchain
            .subscribeToEvent(contractName, event, eventOpts, callback, periodMills, untilMills);
    }

    /**
     * Adds bid to the offer on Ethereum blockchain
     * @param dcWallet Wallet of the bidder
     * @param dataId ID of the data of the bid
     * @param nodeId KADemlia ID of this node
     * @param bidHash Hashed bid that will be revealed once revealBid() is called. @note token amount cannot be greater then max token amount
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
}

module.exports = Blockchain;
