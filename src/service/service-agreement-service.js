import { ethers, BigNumber } from 'ethers';

class ServiceAgreementService {
    constructor(ctx) {
        this.logger = ctx.logger;

        this.validationModuleManager = ctx.validationModuleManager;
        this.blockchainModuleManager = ctx.blockchainModuleManager;
        this.repositoryModuleManager = ctx.repositoryModuleManager;
        this.shardingTableService = ctx.shardingTableService;
        this.networkModuleManager = ctx.networkModuleManager;
    }

    async generateId(assetTypeContract, tokenId, keyword, hashFunctionId) {
        return this.validationModuleManager.callHashFunction(
            hashFunctionId,
            ethers.utils.solidityPack(
                ['address', 'uint256', 'bytes'],
                [assetTypeContract, tokenId, keyword],
            ),
        );
    }

    randomIntFromInterval(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    async calculateScore(blockchainId, keyword, hashFunctionId) {
        const peerRecord = await this.repositoryModuleManager.getPeerRecord(
            this.networkModuleManager.getPeerId().toB58String(),
            blockchainId,
        );
        const keyHash = await this.validationModuleManager.callHashFunction(
            hashFunctionId,
            keyword,
        );

        const hashFunctionName = await this.blockchainModuleManager.getHashFunctionName(
            blockchainId,
            hashFunctionId,
        );

        const distanceUint8Array = this.shardingTableService.calculateDistance(
            peerRecord[hashFunctionName],
            keyHash,
        );
        const distanceUint256BN = BigNumber.from(distanceUint8Array);

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
        } = await this.blockchainModuleManager.getLog2PLDSFParams(blockchainId);

        const mappedStake = BigNumber.from(peerRecord.stake).div(stakeMappingCoefficient);
        const mappedDistance = distanceUint256BN.div(distanceMappingCoefficient);

        const dividend = mappedStake.pow(stakeExponent).mul(a).add(b);
        const divisor = mappedDistance.pow(distanceExponent).mul(c).add(d);

        return Math.floor(
            multiplier * Math.log2(logArgumentConstant + dividend.toNumber() / divisor.toNumber()),
        );
    }
}

export default ServiceAgreementService;
