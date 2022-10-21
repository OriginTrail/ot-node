class ShardingTableService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.eventEmitter = ctx.eventEmitter;
    }

    initialize(blockchain) {
        this.pullBlockchainShardingTable(blockchain);
        // this.listenOnEvents();
    }

    pullBlockchainShardingTable(blockchain) {
        const shardingTable = this.blockchainModuleManager.getShardingTableFull(blockchain);

        // option 1
        // TODO: Find IP addresses
        const multiaddresses = this.networkModuleManager.getPeerStoreIpAddresses();
        shardingTable.map((peer) => peer.add(multiaddresses.get(peer.id))); // 2 index is peerId
        shardingTable.forEach((peer) => this.repositoryModuleManager.createPeerRecord(...peer));

        // option 2
        // TODO: Find IP addresses
        this.repositoryModuleManager.createManyPeerRecords(shardingTable);
    }

    listenOnEvents() {
        this.eventEmitter.on('PeerObjCreated', (eventData) => {
            this.repositoryModuleManager.createPeerRecord(
                eventData.peerId,
                eventData.ask,
                eventData.stake,
            );
        });

        this.eventEmitter.on('PeerParamsUpdated', (eventData) => {
            this.repositoryModuleManager.updatePeerParams(
                eventData.peerId,
                eventData.ask,
                eventData.stake,
            );
        });

        this.eventEmitter.on('PeerRemoved', (eventData) => {
            this.repositoryModuleManager.removePeerRecord(eventData.peerId);
        });
    }

    async findNeighbourhood(assertionId, r2) {
        return this.repositoryModuleManager.getNeighbourhood(assertionId, r2);
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
