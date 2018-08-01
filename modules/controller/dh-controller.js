class DHController {
    constructor(ctx) {
        this.logger = ctx.logger;
        this.commandExecutor = ctx.commandExecutor;
    }

    /**
     * Handle one offer
     * @param importId
     * @param dcNodeId
     * @param totalEscrowTime
     * @param maxTokenAmount
     * @param minStakeAmount
     * @param minReputation
     * @param dataSizeBytes
     * @param dataHash
     * @param predeterminedBid
     * @returns {Promise<void>}
     */
    async handleOffer(
        importId, dcNodeId, totalEscrowTime,
        maxTokenAmount, minStakeAmount, minReputation,
        dataSizeBytes, dataHash, predeterminedBid,
    ) {
        await this.commandExecutor.add({
            name: 'dhOfferHandle',
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
     * @param importId
     * @param vertices
     * @param edges
     * @param wallet
     * @param publicKey
     * @returns {Promise<void>}
     */
    async handleReplicationImport(importId, vertices, edges, wallet, publicKey) {
        await this.commandExecutor.add({
            name: 'dhOfferHandleImport',
            data: {
                importId,
                vertices,
                edges,
                wallet,
                publicKey,
            },
            transactional: false,
        });
    }
}
