import Sequelize from 'sequelize';

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

        const queryOptions = {
            attributes: [
                'blockchainId',
                'ual',
                'paranetUal',
                [Sequelize.fn('MAX', Sequelize.col('created_at')), 'latestCreatedAt'],
                [Sequelize.fn('COUNT', Sequelize.col('ual')), 'retryCount'],
            ],
            where: {
                paranetUal,
            },
            group: ['ual', 'blockchainId', 'paranetUal'],
            having: Sequelize.and(
                Sequelize.literal(`COUNT(ual) < ${retryCountLimit}`),
                Sequelize.literal(`MAX(created_at) <= '${delayDate.toISOString()}'`),
            ),
        };

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
        const records = await this.model.findAll({
            attributes: ['paranet_ual', 'ual'],
            where: {
                paranetUal,
            },
            group: ['paranet_ual', 'ual'],
        });

        return records.length;
    }

    async getFilteredCountOfMissedAssetsOfParanet(paranetUal, retryCountLimit, retryDelayInMs) {
        const now = new Date();
        const delayDate = new Date(now.getTime() - retryDelayInMs);

        const records = await this.model.findAll({
            attributes: [
                [Sequelize.fn('MAX', Sequelize.col('created_at')), 'latestCreatedAt'],
                [Sequelize.fn('COUNT', Sequelize.col('ual')), 'retryCount'],
            ],
            where: {
                paranetUal,
            },
            group: ['paranet_ual', 'ual'],
            having: {
                retryCount: {
                    [Sequelize.Op.lt]: retryCountLimit,
                },
                latestCreatedAt: {
                    [Sequelize.Op.lte]: delayDate,
                },
            },
        });

        return records.length;
    }
}

export default MissedParanetAssetRepository;
