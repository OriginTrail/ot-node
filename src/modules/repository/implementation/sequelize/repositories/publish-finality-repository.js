class PublishFinalityRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.publish_finality;
    }

    async createFinalityRecord(ual, blockchainId, options) {
        return this.model.create({ ual, blockchainId, finality: 1 }, { ...options });
    }

    async getFinality(ual, options) {
        return this.model.findOne({
            where: { ual },
            ...options,
        })?.finality;
    }

    async increaseFinality(ual, options) {
        return this.model.increment('finality', {
            by: 1,
            where: { ual },
            ...options,
        });
    }
}

export default PublishFinalityRepository;
