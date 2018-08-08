const uuidv4 = require('uuid/v4');

/**
 * Encapsulates DC related methods
 */
class DCController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Creates offer
     * @param importId  - Import ID
     * @param rootHash  - Import root hash
     * @param totalDocuments - Number of documents in import
     * @param {number} [totalEscrowTime] - Total escrow time
     * @param {number} [maxTokenAmount] - DH max token amount
     * @param {number} [minStakeAmount] - DH min stake amount
     * @param {number} [minReputation] - DH min reputation
     * @returns {Promise<*>}
     */
    async createOffer(
        importId, rootHash, totalDocuments, totalEscrowTime,
        maxTokenAmount, minStakeAmount, minReputation,
    ) {
        const replicationId = uuidv4();

        await this.commandExecutor.add({
            name: 'dcOfferCancelCommand',
            sequence: [
                'dcOfferRootHashCommand', 'dcOfferCreateDatabaseCommand',
                'dcOfferCreateBlockchainCommand', 'dcOfferReadyCommand',
                'dcOfferChooseCommand', 'dcOfferFinalizedCommand',
            ],
            delay: 0,
            data: {
                importId,
                replicationId,
                rootHash,
                totalDocuments,
                totalEscrowTime,
                maxTokenAmount,
                minStakeAmount,
                minReputation,
            },
            transactional: false,
        });

        return replicationId;
    }

    /**
     * Verify DH keys generated on replication
     * @param importId  - Import ID
     * @param dhNodeId  - DH node ID
     * @param dhWallet  - DH wallet
     * @param epk       - EPK parameter
     * @param encryptionKey - Encryption key
     * @returns {Promise<void>}
     */
    async verifyKeys(importId, dhNodeId, dhWallet, epk, encryptionKey) {
        await this.commandExecutor.add({
            name: 'dcOfferKeyVerificationCommand',
            delay: 0,
            data: {
                dhNodeId,
                dhWallet,
                epk,
                importId,
                encryptionKey,
            },
            transactional: false,
        });
    }
}

module.exports = DCController;

