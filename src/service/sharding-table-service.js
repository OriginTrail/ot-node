class ShardingTableService {
    constructor(ctx) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.networkModuleManager = ctx.networkModuleManager;
        this.eventEmitter = ctx.eventEmitter;
    }

    async initialize(blockchain) {
        await this.pullBlockchainShardingTable(blockchain);
        // this.listenOnEvents();
    }

    async pullBlockchainShardingTable(blockchain) {
        const shardingTable = await this.blockchainModuleManager.getShardingTableFull(blockchain);
        const multiaddresses = this.networkModuleManager.getPeerStoreIpAddresses();

        shardingTable.map((peer) => peer.add(multiaddresses.get(peer.id)));
        shardingTable.forEach((peer) => this.repositoryModuleManager.createPeerRecord(...peer));
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
