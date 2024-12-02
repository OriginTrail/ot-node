class BlockchainRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.blockchain;
    }

    async getLastCheckedBlock(blockchain) {
        return this.model.findOne({
            where: { blockchain },
        });
    }

    async updateLastCheckedBlock(blockchain, currentBlock, timestamp, options) {
        return this.model.upsert(
            {
                blockchain,
                lastCheckedBlock: currentBlock,
                lastCheckedTimestamp: timestamp,
            },
            options,
        );
    }
}

export default BlockchainRepository;
