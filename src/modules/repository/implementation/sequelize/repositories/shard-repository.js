import Sequelize from 'sequelize';

class ShardRepository {
    constructor(models) {
        this.sequelize = models.sequelize;
        this.model = models.shard;
    }

    async createManyPeerRecords(peers) {
        return this._bulkUpdatePeerRecords(peers, ['ask', 'stake', 'sha256']);
    }

    async _bulkUpdatePeerRecords(peerRecords, updateColumns) {
        return this.model.bulkCreate(
            peerRecords.map((peerRecord) => ({
                ask: 0,
                stake: 0,
                sha256: '',
                ...peerRecord,
            })),
            {
                validate: true,
                updateOnDuplicate: updateColumns,
            },
        );
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

    async getAllPeerRecords(blockchainId, filterLastSeen) {
        const query = {
            where: {
                blockchainId,
            },
        };

        if (filterLastSeen) {
            query.where.lastSeen = {
                [Sequelize.Op.gte]: Sequelize.col('last_dialed'),
            };
        }

        return this.model.findAll(query);
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
            limit,
            raw: true,
        });
        return (result ?? []).map((record) => ({ peerId: record.peer_id }));
    }

    async updatePeersAsk(peerRecords) {
        return this._bulkUpdatePeerRecords(peerRecords, ['ask']);
    }

    async updatePeersStake(peerRecords) {
        return this._bulkUpdatePeerRecords(peerRecords, ['stake']);
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

    async removePeerRecords(peerRecords) {
        await this.model.bulkDestroy(peerRecords);
    }

    async cleanShardingTable(blockchainId) {
        await this.model.destroy({
            where: blockchainId ? { blockchainId } : {},
        });
    }
}

export default ShardRepository;
