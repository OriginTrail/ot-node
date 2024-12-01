import Sequelize from 'sequelize';

class ShardRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.shard;
    }

    async createManyPeerRecords(peerRecords, options) {
        return this.model.bulkCreate(peerRecords, {
            validate: true,
            updateOnDuplicate: ['ask', 'stake', 'sha256'],
            ...options,
        });
    }

    async removeShardingTablePeerRecords(blockchainId, options) {
        return this.model.destroy({
            where: { blockchainId },
            ...options,
        });
    }

    async createPeerRecord(peerId, blockchainId, ask, stake, lastSeen, sha256, options) {
        return this.model.create(
            {
                peerId,
                blockchainId,
                ask,
                stake,
                lastSeen,
                sha256,
            },
            {
                ignoreDuplicates: true,
                ...options,
            },
        );
    }

    async getAllPeerRecords(blockchainId) {
        const query = {
            where: {
                blockchainId,
            },
            attributes: [
                'peerId',
                'blockchainId',
                'ask',
                'stake',
                'lastSeen',
                'lastDialed',
                'sha256',
            ],
            order: [['sha256', 'asc']],
        };

        return this.model.findAll(query);
    }

    async getPeerRecordsByIds(blockchainId, peerIds) {
        return this.model.findAll({
            where: {
                blockchainId,
                peerId: {
                    [Sequelize.Op.in]: peerIds,
                },
            },
        });
    }

    async getPeerRecord(peerId, blockchainId) {
        return this.model.findOne({
            where: {
                blockchainId,
                peerId,
            },
        });
    }

    async getPeersCount(blockchainId) {
        return this.model.count({
            where: {
                blockchainId,
            },
        });
    }

    async getPeersToDial(limit, dialFrequencyMillis) {
        const result = await this.model.findAll({
            attributes: ['peer_id'],
            where: {
                lastDialed: {
                    [Sequelize.Op.lt]: new Date(Date.now() - dialFrequencyMillis),
                },
            },
            order: [['last_dialed', 'asc']],
            group: ['peer_id', 'last_dialed'],
            limit,
            raw: true,
        });
        return (result ?? []).map((record) => ({ peerId: record.peer_id }));
    }

    async updatePeerAsk(peerId, blockchainId, ask, options) {
        return this.model.update(
            { ask },
            {
                where: {
                    peerId,
                    blockchainId,
                },
                ...options,
            },
        );
    }

    async updatePeerStake(peerId, blockchainId, stake, options) {
        return this.model.update(
            { stake },
            {
                where: {
                    peerId,
                    blockchainId,
                },
                ...options,
            },
        );
    }

    async updatePeerRecordLastDialed(peerId, timestamp, options) {
        return this.model.update(
            {
                lastDialed: timestamp,
            },
            {
                where: { peerId },
                ...options,
            },
        );
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp, options) {
        return this.model.update(
            {
                lastDialed: timestamp,
                lastSeen: timestamp,
            },
            {
                where: { peerId },
                ...options,
            },
        );
    }

    async removePeerRecord(blockchainId, peerId, options) {
        await this.model.destroy({
            where: {
                blockchainId,
                peerId,
            },
            ...options,
        });
    }

    async cleanShardingTable(blockchainId, options) {
        await this.model.destroy({
            where: blockchainId ? { blockchainId } : {},
            ...options,
        });
    }

    async isNodePartOfShard(blockchainId, peerId) {
        const nodeIsPartOfShard = await this.model.findOne({
            where: { blockchainId, peerId },
        });

        return !!nodeIsPartOfShard;
    }
}

export default ShardRepository;
