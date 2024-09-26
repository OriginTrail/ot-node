class ParanetSyncedAssetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.paranet_synced_asset;
    }

    async createParanetSyncedAssetRecord(
        blockchainId,
        ual,
        paranetUal,
        publicAssertionId,
        privateAssertionId,
        sender,
        transactionHash,
    ) {
        return this.model.create({
            blockchainId,
            ual,
            paranetUal,
            publicAssertionId,
            privateAssertionId,
            sender,
            transactionHash,
        });
    }
}

export default ParanetSyncedAssetRepository;
