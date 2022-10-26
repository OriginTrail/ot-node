import { PEER_OFFLINE_LIMIT } from '../constants/constants.js';

class ShardingTableService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.eventEmitter = ctx.eventEmitter;
    }

    async initialize(blockchainId) {
        // await this.pullBlockchainShardingTable(blockchainId);
        this.listenOnEvents(blockchainId);
    }

    async pullBlockchainShardingTable(blockchain) {
        const shardingTable = await this.blockchainModuleManager.getShardingTableFull(blockchain);

        const textEncoder = new TextEncoder();
        await this.repositoryModuleManager.createManyPeerRecords(
            await Promise.all(
                shardingTable.map(async (peer) => ({
                    peer_id: peer.id._idB58String,
                    blockchain_id: blockchain,
                    ask: peer.ask,
                    stake: peer.stake,
                    last_seen: Date.now(),
                    sha256: (
                        await this.networkModuleManager.toHash(
                            textEncoder.encode(peer.id._idB58String),
                        )
                    ).toString('hex'),
                })),
            ),
        );
    }

    listenOnEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-PeerObjCreated`, (event) => {
            const eventData = JSON.parse(event.data);
            this.repositoryModuleManager.createPeerRecord(
                eventData.peerId,
                event.blockchain_id,
                eventData.ask,
                eventData.stake,
                Date.now(),
                eventData.sha,
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-PeerParamsUpdated`, (event) => {
            const eventData = JSON.parse(event.data);
            this.repositoryModuleManager.updatePeerParams(
                eventData.peerId,
                eventData.ask,
                eventData.stake,
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on('PeerRemoved', (event) => {
            const eventData = JSON.parse(event.data);
            this.repositoryModuleManager.removePeerRecord(eventData.peerId);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });
    }

    async findNeighbourhood(key, blockchain, r2) {
        const peers = await this.repositoryModuleManager.getAllPeerRecords(
            blockchain,
            PEER_OFFLINE_LIMIT,
        );

        return this.networkModuleManager.sortPeers(key, peers, r2);
    }

    async getBidSuggestion(neighbourhood, R0, higherPercentile) {
        const neighbourhoodSortedByAsk = neighbourhood.sort(
            (node_one, node_two) => node_one.ask < node_two.ask,
        );

        const eligibleNodes = neighbourhoodSortedByAsk.slice(
            0,
            Math.ceil((higherPercentile / 100) * neighbourhood.length),
        );

        const eligibleNodesSortedByStake = eligibleNodes.sort(
            (node_one, node_two) => node_one.stake > node_two.stake,
        );

        const awardedNodes = eligibleNodesSortedByStake.slice(0, R0);

        return Math.max(...awardedNodes.map((node) => node.ask)) * R0;
    }

    async findEligibleNodes(neighbourhood, bid, R1, R0) {
        return neighbourhood.filter((node) => node.ask <= bid / R0).slice(0, R1);
    }
}

export default ShardingTableService;
