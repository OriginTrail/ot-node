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

    async removeShardingTablePeerRecords(blockchain) {
        return this.model.destroy({
            where: { blockchain_id: blockchain },
        });
    }

    async createPeerRecord(peerId, blockchain, ask, stake, lastSeen, sha256) {
        return this.model.create(
            {
                peer_id: peerId,
                blockchain_id: blockchain,
                ask,
                stake,
                last_seen: lastSeen,
                sha256,
            },
            {
                ignoreDuplicates: true,
            },
        );
    }

    async getAllPeerRecords(blockchain, filterLastSeen) {
        const query = {
            where: {
                blockchain_id: {
                    [Sequelize.Op.eq]: blockchain,
                },
            },
            raw: true,
        };

        if (filterLastSeen) {
            query.where.last_seen = {
                [Sequelize.Op.gte]: Sequelize.col('last_dialed'),
            };
        }

        return this.model.findAll(query);
    }

    async getPeerRecord(peerId, blockchain) {
        return this.model.findOne({
            where: {
                blockchain_id: {
                    [Sequelize.Op.eq]: blockchain,
                },
                peer_id: {
                    [Sequelize.Op.eq]: peerId,
                },
            },
            raw: true,
        });
    }

    async getPeersCount(blockchain) {
        return this.model.count({
            where: {
                blockchain_id: blockchain,
            },
        });
    }

    async getPeersToDial(limit, dialFrequencyMillis) {
        return this.model.findAll({
            attributes: ['peer_id'],
            where: {
                last_dialed: {
                    [Sequelize.Op.lt]: new Date(Date.now() - dialFrequencyMillis),
                },
            },
            order: [['last_dialed', 'asc']],
            limit,
            raw: true,
        });
    }

    async updatePeersAsk(peerRecords) {
        return this._bulkUpdatePeerRecords(peerRecords, ['ask']);
    }

    async updatePeersStake(peerRecords) {
        return this._bulkUpdatePeerRecords(peerRecords, ['stake']);
    }

    async updatePeerRecordLastDialed(peerId, timestamp) {
        await this.model.update(
            {
                last_dialed: timestamp,
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async updatePeerRecordLastSeenAndLastDialed(peerId, timestamp) {
        await this.model.update(
            {
                last_dialed: timestamp,
                last_seen: timestamp,
            },
            {
                where: { peer_id: peerId },
            },
        );
    }

    async removePeerRecords(peerRecords) {
        await this.model.bulkDestroy(peerRecords);
    }

    async cleanShardingTable(blockchainId) {
        await this.model.destroy({
            where: blockchainId ? { blockchain_id: blockchainId } : {},
        });
    }
}

export default ShardRepository;
