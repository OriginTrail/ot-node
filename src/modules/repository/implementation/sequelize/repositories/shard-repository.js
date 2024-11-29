import Sequelize from 'sequelize';

class ShardRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.shard;
    }

    async createManyPeerRecords(peerRecords) {
        return this.model.bulkCreate(peerRecords, {
            validate: true,
            updateOnDuplicate: ['ask', 'stake', 'sha256'],
        });
    }

    async removeShardingTablePeerRecords(blockchainId) {
        return this.model.destroy({
            where: { blockchainId },
        });
    }

    async createPeerRecord(peerId, blockchainId, ask, stake, lastSeen, sha256) {
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

    async updatePeerAsk(peerId, blockchainId, ask) {
        return this.model.update(
            { ask },
            {
                where: {
                    peerId,
                    blockchainId,
                },
            },
        );
    }

    async updatePeerStake(peerId, blockchainId, stake) {
        return this.model.update(
            { stake },
            {
                where: {
                    peerId,
                    blockchainId,
                },
            },
        );
    }

    async updatePeerRecordLastDialed(peerId, timestamp) {
        return this.model.update(
            {
                lastDialed: timestamp,
            },
            {
                where: { peerId },
            },
        );
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp) {
        return this.model.update(
            {
                lastDialed: timestamp,
                lastSeen: timestamp,
            },
            {
                where: { peerId },
            },
        );
    }

    async removePeerRecord(blockchainId, peerId) {
        await this.model.destroy({
            where: {
                blockchainId,
                peerId,
            },
        });
    }

    async cleanShardingTable(blockchainId) {
        await this.model.destroy({
            where: blockchainId ? { blockchainId } : {},
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
