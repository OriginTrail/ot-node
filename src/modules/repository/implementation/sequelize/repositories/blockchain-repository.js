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

    async removeLastCheckedBlockForContract(contract) {
        return this.model.destroy({
            where: {
                contract,
            },
        });
    }

    async updateLastCheckedBlock(blockchainId, currentBlock, timestamp, contract) {
        return this.model.upsert({
            blockchainId,
            contract,
            lastCheckedBlock: currentBlock,
            lastCheckedTimestamp: timestamp,
        });
    }
}

export default BlockchainRepository;
