import { OPERATION_ID_STATUS } from '../../../../../constants/constants.js';

class AssetSyncRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.asset_sync;
    }

    async createAssetSyncRecord(
        blockchainId,
        assetStorageContract,
        tokenId,
        stateIndex,
        status,
        insertedByCommand,
    ) {
        return this.model.create(
            {
                blockchainId,
                assetStorageContract,
                tokenId,
                stateIndex,
                status,
                insertedByCommand,
            },
            {
                ignoreDuplicates: true,
            },
        );
    }

    async updateAssetSyncRecord(
        blockchainId,
        assetStorageContract,
        tokenId,
        stateIndex,
        status,
        insertedByCommand,
    ) {
        return this.model.update(
            {
                status,
                insertedByCommand,
            },
            {
                where: {
                    blockchainId,
                    assetStorageContract,
                    tokenId,
                    stateIndex,
                },
            },
        );
    }

    async isStateSynced(blockchainId, assetStorageContract, tokenId, stateIndex) {
        return this.model.count({
            where: {
                blockchainId,
                assetStorageContract,
                tokenId,
                stateIndex,
            },
        });
    }

    async getLatestAssetSyncRecord(blockchainId, assetStorageContract) {
        return this.model.findOne({
            where: {
                blockchainId,
                assetStorageContract,
                status: OPERATION_ID_STATUS.COMPLETED,
                insertedByCommand: true,
            },
            order: [
                ['token_id', 'DESC'],
                ['state_index', 'DESC'],
            ],
            limit: 1,
        });
    }

    async getAssetSyncTokenIds(blockchainId, assetStorageContract) {
        const tokenIds = this.model.findAll({
            attributes: ['tokenId'],
            where: {
                blockchainId,
                assetStorageContract,
            },
        });
        return tokenIds.map((t) => t.tokenId);
    }
}

export default AssetSyncRepository;
