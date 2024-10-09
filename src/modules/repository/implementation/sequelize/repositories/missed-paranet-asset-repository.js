class MissedParanetAssetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.missed_paranet_asset;
    }

    async createMissedParanetAssetRecord(missedParanetAsset) {
        return this.model.create(missedParanetAsset);
    }

    async getMissedParanetAssetsRecordsWithRetryCount(
        paranetUal,
        retryCountLimit,
        retryDelayInMs,
        count = null,
    ) {
        const now = new Date();
        const delayDate = new Date(now.getTime() - retryDelayInMs);

        const queryOptions = this.model.findAll({
            attributes: [
                'blockchainId',
                'ual',
                'paranetUal',
                'knowledgeAssetId',
                [this.sequelize.fn('MAX', this.sequelize.col('createdAt')), 'latestCreatedAt'],
                [this.sequelize.fn('COUNT', this.sequelize.col('ual')), 'retryCount'],
            ],
            where: {
                paranetUal,
            },
            group: ['ual', 'blockchainId', 'paranetUal', 'knowledgeAssetId'],
            having: {
                retryCount: {
                    [this.sequelize.Op.lt]: retryCountLimit,
                },
                latestCreatedAt: {
                    [this.sequelize.Op.lte]: delayDate,
                },
            },
        });

        if (count !== null) {
            queryOptions.limit = count;
        }

        return this.model.findAll(queryOptions);
    }

    async removeMissedParanetAssetRecordsByUAL(ual) {
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
            group: ['paranetUal', 'ual'],
        });
    }

    async getFilteredCountOfMissedAssetsOfParanet(paranetUal, retryCountLimit, retryDelayInMs) {
        const now = new Date();
        const delayDate = new Date(now.getTime() - retryDelayInMs);

        return this.model.count({
            attributes: [
                [this.sequelize.fn('MAX', this.sequelize.col('createdAt')), 'latestCreatedAt'],
                [this.sequelize.fn('COUNT', this.sequelize.col('ual')), 'retryCount'],
            ],
            where: {
                paranetUal,
            },
            group: ['paranetUal', 'ual'],
            having: {
                retryCount: {
                    [this.sequelize.Op.lt]: retryCountLimit,
                },
                latestCreatedAt: {
                    [this.sequelize.Op.lte]: delayDate,
                },
            },
        });
    }
}

export default MissedParanetAssetRepository;
