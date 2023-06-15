import Sequelize from 'sequelize';
import { ASSET_SYNC_PARAMETERS } from '../../../../../constants/constants.js';

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
                status: { [Sequelize.Op.not.eq]: ASSET_SYNC_PARAMETERS.STATUS.IN_PROGRESS },
            },
        });
    }

    async getLatestAssetSyncRecord(blockchainId, assetStorageContract) {
        return this.model.findOne({
            where: {
                blockchainId,
                assetStorageContract,
                status: { [Sequelize.Op.not.eq]: ASSET_SYNC_PARAMETERS.STATUS.IN_PROGRESS },
                insertedByCommand: true,
            },
            order: [
                ['tokenId', 'DESC'],
                ['stateIndex', 'DESC'],
            ],
            limit: 1,
        });
    }

    async getAssetSyncTokenIds(blockchainId, assetStorageContract) {
        const tokenIds = await this.model.findAll({
            attributes: ['tokenId'],
            where: {
                blockchainId,
                assetStorageContract,
                status: { [Sequelize.Op.not.eq]: ASSET_SYNC_PARAMETERS.STATUS.IN_PROGRESS },
            },
            order: [['tokenId', 'ASC']],
        });
        return tokenIds.map((t) => t.tokenId);
    }
}

export default AssetSyncRepository;
