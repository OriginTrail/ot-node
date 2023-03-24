class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    async generateId(blockchain, assetTypeContract, tokenId, keyword, hashFunctionId) {
        return this.validationModuleManager.callHashFunction(
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

    async calculateScore(peerId, blockchainId, keyword, hashFunctionId) {
        const peerRecord = await this.repositoryModuleManager.getPeerRecord(peerId, blockchainId);
        const keyHash = await this.validationModuleManager.callHashFunction(
            hashFunctionId,
            keyword,
        );

        const hashFunctionName = this.validationModuleManager.getHashFunctionName(hashFunctionId);

        const distanceUint8Array = this.shardingTableService.calculateDistance(
            blockchainId,
            peerRecord[hashFunctionName],
            keyHash,
        );

        // todo: store this in a more appropriate way
        if (!this.log2PLDSFParams) {
            this.log2PLDSFParams = await this.blockchainModuleManager.getLog2PLDSFParams(
                blockchainId,
            );
        }

        const {
            distanceMappingCoefficient,
            stakeMappingCoefficient,
            multiplier,
            logArgumentConstant,
            a,
            stakeExponent,
            b,
            c,
            distanceExponent,
            d,
        } = this.log2PLDSFParams;

        const distanceUint256BN = this.blockchainModuleManager.toBigNumber(
            blockchainId,
            distanceUint8Array,
        );

        const mappedStake = this.blockchainModuleManager
            .toBigNumber(
                blockchainId,
                this.blockchainModuleManager.convertToWei(blockchainId, peerRecord.stake),
            )
            .div(stakeMappingCoefficient);
        const mappedDistance = distanceUint256BN.div(distanceMappingCoefficient);

        const dividend = mappedStake.pow(stakeExponent).mul(a).add(b);
        const divisor = mappedDistance.pow(distanceExponent).mul(c).add(d);

        return Math.floor(
            Number(multiplier) *
                Math.log2(Number(logArgumentConstant) + dividend.toNumber() / divisor.toNumber()),
        );
    }
}

export default ServiceAgreementService;
