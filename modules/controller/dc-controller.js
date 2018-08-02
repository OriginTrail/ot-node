const uuidv4 = require('uuid/v4');

class DCController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Creates new offer
     * @param importId
     * @param rootHash
     * @param totalDocuments
     * @param totalEscrowTime
     * @param maxTokenAmount
     * @param minStakeAmount
     * @param minReputation
     * @returns {*}
     */
    async createOffer(
        importId, rootHash, totalDocuments, totalEscrowTime,
        maxTokenAmount, minStakeAmount, minReputation,
    ) {
        const replicationId = uuidv4();

        await this.commandExecutor.add({
            name: 'dcOfferCancel',
            sequence: [
                'dcOfferRootHash', 'dcOfferCreateDB',
                'dcOfferCreateBlockchain', 'dcOfferReady',
                'dcOfferChoose', 'dcOfferFinalized',
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
     * @param importId
     * @param dhNodeId
     * @param dhWallet
     * @param epk
     * @param encryptionKey
     * @returns {Promise<void>}
     */
    async verifyKeys(importId, dhNodeId, dhWallet, epk, encryptionKey) {
        await this.commandExecutor.add({
            name: 'dcOfferKeyVerification',
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

