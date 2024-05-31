class MissedParanetAssetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.missed_paranet_asset;
    }

    async createMissedParanetAssetRecord(missedParanetAsset) {
        return this.model.create(missedParanetAsset);
    }

    async getMissedParanetAssetsRecords(paranetUal, count = null) {
        const queryOptions = {
            where: {
                paranetUal,
            },
        };

        if (count !== null) {
            queryOptions.limit = count;
        }

        return this.model.findAll(queryOptions);
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
