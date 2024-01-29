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

    async calculateScore(
        peerId,
        blockchainId,
        keyword,
        hashFunctionId,
        proximityScoreFunctionsPairId,
        maxNeighborhoodDistance,
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

        return this.proximityScoringService.callScoreFunction(
            blockchainId,
            proximityScoreFunctionsPairId,
            distance,
            peerRecord.stake,
            maxNeighborhoodDistance,
        );
    }
}

export default ServiceAgreementService;
