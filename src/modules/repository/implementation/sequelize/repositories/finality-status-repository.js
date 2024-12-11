class FinalityStatusRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.finality_status;
    }

    async getFinalityAcksCount(ual, options) {
        return this.model.count({
            where: { ual },
            ...options,
        });
    }

    async saveFinalityAck(operationId, ual, peerId, options) {
        return this.model.upsert({ operationId, ual, peerId }, options);
    }
}

export default FinalityStatusRepository;
