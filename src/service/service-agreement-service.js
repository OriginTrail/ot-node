// TODO: Delete whole file
class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;
        this.hashingService = ctx.hashingService;
        this.proximityScoringService = ctx.proximityScoringService;
        this.cryptoService = ctx.cryptoService;
    }

    // TODO: Changed function signature change everywhere
    generateId(assetTypeContract, tokenId, keyword, hashFunctionId) {
        return this.hashingService.callHashFunction(
            hashFunctionId,
            this.cryptoService.encodePacked(
                ['address', 'uint256', 'bytes'],
                [assetTypeContract, tokenId, keyword],
            ),
        );
    }

    randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    async calculateBid(blockchain, blockchainAssertionSize, agreementData, r0) {
        const currentEpoch = await this.calculateCurrentEpoch(
            agreementData.startTime,
            agreementData.epochLength,
            blockchain,
        );

        // todo: consider optimizing to take into account cases where some proofs have already been submitted
        const epochsLeft = Number(agreementData.epochsNumber) - currentEpoch;

        const divisor = this.cryptoService
            .toBigNumber(r0)
            .mul(epochsLeft)
            .mul(blockchainAssertionSize);

        return agreementData.tokenAmount
            .add(agreementData.updateTokenAmount)
            .mul(1024)
            .div(divisor)
            .add(1); // add 1 wei because of the precision loss
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
            maxNeighborhoodDistance = neighbourhoodEdges.leftEdge.distance.gt(
                neighbourhoodEdges.rightEdge.distance,
            )
                ? neighbourhoodEdges.leftEdge.distance
                : neighbourhoodEdges.rightEdge.distance;
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

    async calculateCurrentEpoch(startTime, epochLength, blockchain) {
        const now = await this.blockchainModuleManager.getBlockchainTimestamp(blockchain);
        return Math.floor((Number(now) - Number(startTime)) / Number(epochLength));
    }
}

export default ServiceAgreementService;
