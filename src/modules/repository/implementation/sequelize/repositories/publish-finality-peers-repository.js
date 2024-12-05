class PublishFinalityPeersRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.publish_finality_peers;
    }

    async saveFinalityAck(ual, peerId, options) {
        return this.model.upsert({ ual, peerId }, options);
    }
}

export default PublishFinalityPeersRepository;
