class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.hashingService = ctx.hashingService;
        this.proximityScoringService = ctx.proximityScoringService;
    }

    async generateId(blockchain, assetTypeContract, tokenId, keyword, hashFunctionId) {
        return this.hashingService.callHashFunction(
            hashFunctionId,
            this.blockchainModuleManager.encodePacked(
                blockchain,
                ['address', 'uint256', 'bytes'],
                [assetTypeContract, tokenId, keyword],
            ),
        );
    }

    randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    async calculateRank(
        blockchain,
        keyword,
        hashFunctionId,
        proximityScoreFunctionsPairId,
        r2,
        neighbourhood,
        neighbourhoodEdges,
        totalNodesNumber,
        minStake,
        maxStake,
    ) {
        const peerId = this.networkModuleManager.getPeerId().toB58String();
        if (!neighbourhood.some((node) => node.peerId === peerId)) {
            return;
        }

        const scores = await Promise.all(
            neighbourhood.map(async (node) => ({
                score: await this.calculateScore(
                    node.peerId,
                    blockchain,
                    keyword,
                    hashFunctionId,
                    proximityScoreFunctionsPairId,
                    neighbourhoodEdges,
                    r2,
                    totalNodesNumber,
                    minStake,
                    maxStake,
                ),
                peerId: node.peerId,
            })),
        );

        scores.sort((a, b) => b.score - a.score);

        return scores.findIndex((node) => node.peerId === peerId);
    }

    async calculateScore(
        peerId,
        blockchainId,
        keyword,
        hashFunctionId,
        proximityScoreFunctionsPairId,
        neighbourhoodEdges,
        r2,
        totalNodesNumber,
        minStake,
        maxStake,
    ) {
        const peerRecord = await this.repositoryModuleManager.getPeerRecord(peerId, blockchainId);
        const keyHash = await this.hashingService.callHashFunction(hashFunctionId, keyword);

        const hashFunctionName = this.hashingService.getHashFunctionName(hashFunctionId);

        const distance = await this.proximityScoringService.callProximityFunction(
            blockchainId,
            proximityScoreFunctionsPairId,
            peerRecord[hashFunctionName],
            keyHash,
        );
        let maxNeighborhoodDistance;
        if (neighbourhoodEdges) {
            maxNeighborhoodDistance = await this.proximityScoringService.callProximityFunction(
                blockchainId,
                proximityScoreFunctionsPairId,
                neighbourhoodEdges.leftEdge[hashFunctionName],
                neighbourhoodEdges.rightEdge[hashFunctionName],
            );
        }

        return this.proximityScoringService.callScoreFunction(
            blockchainId,
            proximityScoreFunctionsPairId,
            distance,
            peerRecord.stake,
            maxNeighborhoodDistance,
            r2,
            totalNodesNumber,
            minStake,
            maxStake,
        );
    }
}

export default ServiceAgreementService;
