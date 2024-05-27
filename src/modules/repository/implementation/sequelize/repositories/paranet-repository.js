class ParanetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.paranet;
    }

    async createParanetRecord(name, description, paranetId, blockchainId) {
        return this.model.create(
            {
                name,
                description,
                paranetId,
                kaCount: 0,
                blockchainId,
            },
            {
                ignoreDuplicates: true,
            },
        );
    }

    async getParanet(paranetId, blockchainId) {
        return this.model.findOne({
            where: {
                paranetId,
                blockchainId,
            },
        });
    }

    async updateParanetKaCount(paranetId, blockchain, kaCount) {
        await this.model.update(
            { kaCount },
            {
                where: {
                    paranetId,
                    blockchain,
                },
            },
        );
    }

    async paranetExists(paranetId, blockchainId) {
        const paranetRecord = await this.model.findOne({
            where: {
                paranetId,
                blockchainId,
            },
        });
        return !!paranetRecord;
    }

    async getParanetKnowledgeAssetsCount(paranetId, blockchainId) {
        return this.model.findAll({
            attributes: ['ka_count'],
            where: {
                paranetId,
                blockchainId,
            },
        });
    }
}

export default ParanetRepository;
