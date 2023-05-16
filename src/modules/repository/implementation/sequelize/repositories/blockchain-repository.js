class BlockchainRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.blockchain;
    }

    async getLastCheckedBlock(blockchainId, contract) {
        return this.model.findOne({
            attributes: ['last_checked_block', 'last_checked_timestamp'],
            where: { blockchain_id: blockchainId, contract },
            raw: true,
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
            blockchain_id: blockchainId,
            contract,
            last_checked_block: currentBlock,
            last_checked_timestamp: timestamp,
        });
    }
}

export default BlockchainRepository;
