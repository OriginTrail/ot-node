class PublishFinalityRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.publish_finality;
    }

    async createFinalityRecord(operationId, options) {
        return this.model.upsert({ operationId, finality: 0 }, { ...options });
    }

    async getFinality(ual, options) {
        return this.model.findOne({
            where: { ual },
            ...options,
        })?.finality;
    }

    async increaseFinality(operationId, ual, options) {
        return this.model.update(
            {
                finality: this.sequelize.literal('finality + 1'),
                ual,
                operationId,
            },
            {
                where: { operationId },
                ...options,
            },
        );
    }
}

export default PublishFinalityRepository;
