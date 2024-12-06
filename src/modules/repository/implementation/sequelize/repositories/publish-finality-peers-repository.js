class PublishFinalityPeersRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.publish_finality_peers;
    }

    async saveFinalityAck(operationId, ual, peerId, options) {
        return this.model.upsert({ operationId, ual, peerId }, options);
    }
}

export default PublishFinalityPeersRepository;
