import { Sequelize } from 'sequelize';

class ParanetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.paranet;
    }

    async createParanetRecord(name, description, paranetId, blockchainId, options) {
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
                ...options,
            },
        );
    }

    async getParanet(paranetId, blockchainId, options) {
        return this.model.findOne({
            where: {
                paranetId,
                blockchainId,
            },
            ...options,
        });
    }

    async addToParanetKaCount(paranetId, blockchainId, kaCount, options) {
        return this.model.update(
            {
                kaCount: Sequelize.literal(`ka_count + ${kaCount}`),
            },
            {
                where: {
                    paranetId,
                    blockchainId,
                },
                ...options,
            },
        );
    }

    async paranetExists(paranetId, blockchainId, options) {
        const paranetRecord = await this.model.findOne({
            where: {
                paranetId,
                blockchainId,
            },
            ...options,
        });
        return !!paranetRecord;
    }

    async getParanetKnowledgeAssetsCount(paranetId, blockchainId, options) {
        return this.model.findAll({
            attributes: ['ka_count'],
            where: {
                paranetId,
                blockchainId,
            },
            ...options,
        });
    }

    async incrementParanetKaCount(paranetId, blockchainId, options) {
        return this.model.update(
            {
                kaCount: Sequelize.literal(`ka_count + 1`),
            },
            {
                where: {
                    paranetId,
                    blockchainId,
                },
                ...options,
            },
        );
    }

    async getParanetsBlockchains(options) {
        return this.model.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('blockchain_id')), 'blockchain_id'],
            ],
            ...options,
        });
    }
}

export default ParanetRepository;
