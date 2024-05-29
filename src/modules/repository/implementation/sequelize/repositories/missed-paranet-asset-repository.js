class MissedParanetAssetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.operation_ids;
    }

    async createMissedParanetAssetRecord(missedParanetAssset) {
        return this.model.create(missedParanetAssset);
    }

    async getMissedParanetAssetsRecords(blockchainId) {
        return this.model.findOne({
            where: {
                blockchainId,
            },
        });
    }

    async removeMissedParanetAssetRecord(ual) {
        await this.model.destroy({
            where: {
                ual,
            },
        });
    }

    async getCountOfMissedAssetsOfParanet(paranetUal) {
        return this.model.count({
            where: {
                paranetUal,
            },
        });
    }
}

export default MissedParanetAssetRepository;
