class BlockchainRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.blockchain;
    }

    async getLastCheckedBlock(blockchainId, contract) {
        return this.model.findOne({
            where: { blockchainId, contract },
        });
    }

    async removeLastCheckedBlockForContract(contract, options) {
        return this.model.destroy({
            where: {
                contract,
            },
            ...options,
        });
    }

    async updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract, options) {
        return this.model.upsert(
            {
                blockchainId,
                contract,
                lastCheckedBlock: currentBlock,
                lastCheckedTimestamp: timestamp,
            },
            options,
        );
    }
}

export default BlockchainRepository;
