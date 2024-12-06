class PublishFinalityRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.publish_finality;
    }

    async getFinality(ual, options) {
        return this.model.count({
            where: { ual },
            ...options,
        });
    }

    async saveFinalityAck(operationId, ual, peerId, options) {
        return this.model.upsert({ operationId, ual, peerId }, options);
    }
}

export default PublishFinalityRepository;
