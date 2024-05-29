class MissedParanetAssetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.operation_ids;
    }

    async createMissedParanetAssetRecord(missedParanetAssset) {
        return this.model.create(missedParanetAssset);
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
