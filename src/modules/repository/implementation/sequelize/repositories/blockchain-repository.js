class BlockchainRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.blockchain;
    }

    async getLastCheckedBlock(blockchain, contract) {
        if (contract) {
            return this.model.findOne({
                where: { blockchain, contract },
            });
        }

        // Fetch all contracts for the given blockchain
        return this.model.findAll({
            where: { blockchain },
            raw: true,
        });
    }

    async updateLastCheckedBlock(blockchain, contracts, currentBlock, timestamp, options) {
        const rowsToUpdate = contracts.map((contract) => ({
            blockchain,
            contract,
            lastCheckedBlock: currentBlock,
            lastCheckedTimestamp: timestamp,
        }));

        return this.model.bulkCreate(rowsToUpdate, {
            updateOnDuplicate: ['lastCheckedBlock', 'lastCheckedTimestamp'],
            ...options,
        });
    }
}

export default BlockchainRepository;
