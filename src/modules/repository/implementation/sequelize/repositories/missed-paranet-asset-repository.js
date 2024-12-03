import Sequelize from 'sequelize';

class MissedParanetAssetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.missed_paranet_asset;
    }

    async createMissedParanetAssetRecord(missedParanetAsset, options) {
        return this.model.create(missedParanetAsset, options);
    }

    async getMissedParanetAssetsRecordsWithRetryCount(
        paranetUal,
        retryCountLimit,
        retryDelayInMs,
        limit,
        options,
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
            ...options,
        };

        if (limit !== null) {
            queryOptions.limit = limit;
        }

        return this.model.findAll(queryOptions);
    }

    async missedParanetAssetRecordExists(ual, options) {
        const missedParanetAssetRecord = await this.model.findOne({
            where: { ual },
            ...options,
        });

        return !!missedParanetAssetRecord;
    }

    async removeMissedParanetAssetRecordsByUAL(ual, options) {
        await this.model.destroy({
            where: {
                ual,
            },
            ...options,
        });
    }

    async getCountOfMissedAssetsOfParanet(paranetUal, options) {
        const records = await this.model.findAll({
            attributes: ['paranet_ual', 'ual'],
            where: {
                paranetUal,
            },
            group: ['paranet_ual', 'ual'],
            ...options,
        });

        return records.length;
    }

    async getFilteredCountOfMissedAssetsOfParanet(
        paranetUal,
        retryCountLimit,
        retryDelayInMs,
        options,
    ) {
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
            ...options,
        });

        return records.length;
    }
}

export default MissedParanetAssetRepository;
