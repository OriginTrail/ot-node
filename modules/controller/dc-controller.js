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
}

module.exports = DCController;

