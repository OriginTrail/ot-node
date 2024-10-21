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

    async getParanetSyncedAssetRecordByUAL(ual) {
        return this.model.findOne({
            where: { ual },
        });
    }

    async paranetSyncedAssetRecordExists(ual) {
        const paranetSyncedAssetRecord = await this.getParanetSyncedAssetRecordByUAL(ual);

        return !!paranetSyncedAssetRecord;
    }
}

export default ParanetSyncedAssetRepository;
