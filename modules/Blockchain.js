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
     * Initiating escrow for data holding
     * @param {string} - dhWallet
     * @param {number} - dataId
     * @param {number} - tokenAmount
     * @param {number} - totalTime
     * @returns {Promise}
     */
    initiateEscrow(dhWallet, dataId, tokenAmount, totalTime) {
        return this.blockchain.initiateEscrow(dhWallet, dataId, tokenAmount, totalTime);
    }

    /**
     * Verify escrow contract contract data and start data holding process
     * @param {string} - dcWallet
     * @param {number} - dataId
     * @param {number} - tokenAmount
     * @param {number} - totalTime
     * @returns {Promise}
     */
    verifyEscrow(dcWallet, dataId, tokenAmount, totalTime) {
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
}

module.exports = Blockchain;
