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
        await this.pullBlockchainShardingTable(blockchainId);
        await this.listenOnEvents(blockchainId);
        const that = this;
        await this.networkModuleManager.onPeerConnected((connection) => {
            that.repositoryModuleManager
                .updatePeerRecordLastSeenAndLastDialed(connection.remotePeer._idB58String)
                .catch((error) => {
                    this.logger.warn(`Unable to update connected peer, error: ${error.message}`);
                });
        });
    }

    async pullBlockchainShardingTable(blockchainId) {
        const shardingTable = await this.blockchainModuleManager.getShardingTableFull(blockchainId);

        const textEncoder = new TextEncoder();
        await this.repositoryModuleManager.createManyPeerRecords(
            await Promise.all(
                shardingTable.map(async (peer) => ({
                    peer_id: peer.id,
                    blockchain_id: blockchainId,
                    ask: peer.ask,
                    stake: peer.stake,
                    sha256: (
                        await this.networkModuleManager.toHash(textEncoder.encode(peer.id))
                    ).toString('hex'),
                })),
            ),
        );
    }

    async listenOnEvents(blockchainId) {
        this.eventEmitter.on(`${blockchainId}-NodeObjCreated`, async (event) => {
            const eventData = JSON.parse(event.data);

            this.repositoryModuleManager.createPeerRecord(
                eventData.nodeId,
                event.blockchain_id,
                eventData.ask,
                eventData.stake,
                new Date(0),
                (
                    await this.networkModuleManager.toHash(
                        new TextEncoder().encode(eventData.nodeId),
                    )
                ).toString('hex'),
            );

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-StakeUpdated`, (event) => {
            const eventData = JSON.parse(event.data);
            this.repositoryModuleManager.updatePeerStake(eventData.nodeId, eventData.stake);

            this.repositoryModuleManager.markBlockchainEventAsProcessed(event.id);
        });

        this.eventEmitter.on(`${blockchainId}-NodeRemoved`, (event) => {
            const eventData = JSON.parse(event.data);
            this.repositoryModuleManager.removePeerRecord(eventData.nodeId);

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

    async dial(peerId) {
        this.logger.trace(`Searching for peer ${peerId} multiaddresses in peer store.`);
        let { addresses } = this.networkModuleManager.getPeerInfo(peerId);
        if (!addresses.length) {
            try {
                this.logger.trace(`Searching for peer ${peerId} multiaddresses on the network.`);
                addresses = (await this.networkModuleManager.findPeer(peerId)).multiaddrs;
            } catch (error) {
                this.logger.warn(`Unable to find peer ${peerId}. Error: ${error.message}`);
            }
        }
        if (addresses.length) {
            this.logger.trace(`Dialing peer ${peerId}.`);
            await this.networkModuleManager.dial(peerId);
            await this.repositoryModuleManager.updatePeerRecordLastSeenAndLastDialed(peerId);
        } else {
            await this.repositoryModuleManager.updatePeerRecordLastDialed(peerId);
        }
    }
}

export default ShardingTableService;
