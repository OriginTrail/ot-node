class ShardingTableService {
    constructor(ctx, blockchain) {
        this.config = ctx.config;
        this.logger = ctx.logger;
        this.blockchain = blockchain;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
    }

    pullBlockchainShardingTable() {
        const shardingTable = this.blockchainModuleManager.getShardingTableFull();

        // option 1
        // TODO: Find IP addresses
        shardingTable.forEach((peer) => this.blockchainModuleManager.createPeerRecord(...peer));

        // option 2
        // TODO: Find IP addresses
        this.repositoryModuleManager.createManyPeerRecords(shardingTable);
    }

    async updateLocalTable(blockchainTableUpdateEvent) {
        const { peerId, ask, stake } = blockchainTableUpdateEvent.currentTarget;

        await this.repositoryModuleManager.updatePeerRecord(peerId, ask, stake);
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
