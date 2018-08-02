/**
 * Encapsulates DH related methods
 */
class DHController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Handle one offer
     * @param importId  - Import ID
     * @param dcNodeId  - DC node ID
     * @param totalEscrowTime - Total escrow time
     * @param maxTokenAmount - Max token amount per DH
     * @param minStakeAmount - Min stake amount per DH
     * @param minReputation - DH min reputation
     * @param dataSizeBytes - Data size of the import in bytes
     * @param dataHash  - Import root hash
     * @param predeterminedBid  - Is predetermined or not?
     * @returns {Promise<void>}
     */
    async handleOffer(
        importId, dcNodeId, totalEscrowTime,
        maxTokenAmount, minStakeAmount, minReputation,
        dataSizeBytes, dataHash, predeterminedBid,
    ) {
        await this.commandExecutor.add({
            name: 'dhOfferHandleCommand',
            delay: 0,
            data: {
                importId,
                dcNodeId,
                totalEscrowTime,
                maxTokenAmount,
                minStakeAmount,
                minReputation,
                dataSizeBytes,
                dataHash,
                predeterminedBid,
            },
            transactional: false,
        });
    }

    /**
     * Handle one replication payload
     * @param importId  - Import ID
     * @param vertices  - Encrypted import vertices
     * @param edges     - Import edges
     * @param dcWallet  - DC wallet
     * @param publicKey - Decryption key
     * @returns {Promise<void>}
     */
    async handleReplicationImport(importId, vertices, edges, dcWallet, publicKey) {
        await this.commandExecutor.add({
            name: 'dhOfferHandleImportCommand',
            data: {
                importId,
                vertices,
                edges,
                dcWallet,
                publicKey,
            },
            transactional: false,
        });
    }
}

module.exports = DHController;
