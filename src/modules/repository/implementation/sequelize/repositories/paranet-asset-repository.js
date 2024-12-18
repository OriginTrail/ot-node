import Sequelize from 'sequelize';

class ParanetAssetRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.paranet_asset;
    }

    async createParanetAssetRecord(missedParanetAsset, options) {
        return this.model.create({ ...missedParanetAsset, isSynced: false }, options);
    }

    async getCountOfMissedAssetsOfParanet(paranetUal, options = {}) {
        return this.model.count({
            where: {
                paranetUal,
                isSynced: false,
            },
            ...options,
        });
    }

    async getParanetSyncedAssetRecordsCount(paranetUal, options = {}) {
        return this.model.count({
            where: {
                paranet_ual: paranetUal,
                isSynced: true,
            },
            ...options,
        });
    }

    // TODO: remove
    // async getFilteredCountOfMissedAssetsOfParanet(
    //     paranetUal,
    //     retryCountLimit,
    //     retryDelayInMs,
    //     options = {},
    // ) {
    //     const now = new Date();
    //     const delayDate = new Date(now.getTime() - retryDelayInMs);

    //     const records = await this.model.findAll({
    //         where: {
    //             paranetUal,
    //             isSynced: false, // Only unsynced assets
    //             retries: {
    //                 [Sequelize.Op.lt]: retryCountLimit, // Filter by retries count
    //             },
    //             created_at: {
    //                 [Sequelize.Op.lte]: delayDate, // Filter by created_at date
    //             },
    //         },
    //         ...options,
    //     });

    //     return records.length; // Return the count of matching records
    // }

    async getMissedParanetAssetsRecordsWithRetryCount(
        paranetUal,
        retryCountLimit,
        retryDelayInMs,
        limit = null,
        options = {},
    ) {
        const now = new Date();
        const delayDate = new Date(now.getTime() - retryDelayInMs);

        const queryOptions = {
            where: {
                paranetUal,
                isSynced: false,
                retries: {
                    [Sequelize.Op.lt]: retryCountLimit,
                },
                updated_at: {
                    [Sequelize.Op.lte]: delayDate,
                },
            },
            ...options,
        };

        if (limit !== null) {
            queryOptions.limit = limit;
        }

        return this.model.findAll(queryOptions);
    }

    async missedParanetAssetRecordExists(ual, paranetUal, options = {}) {
        const missedParanetAssetRecord = await this.model.findOne({
            where: { ual, isSynced: false },
            ...options,
        });

        return !!missedParanetAssetRecord;
    }

    async paranetSyncedAssetRecordExists(ual, paranetUal, options = {}) {
        const paranetSyncedAssetRecord = await this.model.getParanetSyncedAssetRecordByUAL(
            ual,
            paranetUal,
            options,
        );

        return !!paranetSyncedAssetRecord;
    }

    async updateAssetToBeSynced(ual, paranetUal, options = {}) {
        const [affectedRows] = await this.model.update(
            { isSynced: true },
            {
                where: {
                    ual,
                    paranetUal,
                },
                ...options,
            },
        );

        return affectedRows;
    }

    async incrementRetriesForUalAndParanetUal(ual, paranetUal, options = {}) {
        const [affectedRows] = await this.model.increment('retries', {
            by: 1,
            where: {
                ual,
                paranetUal,
            },
            ...options,
        });

        return affectedRows;
    }
}

export default ParanetAssetRepository;
