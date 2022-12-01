import { ethers } from 'ethers';
import { BigNumber } from 'bignumber.js';

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

    async calculateScore(peerId, blockchainId, keyword, hashFunctionId) {
        const peerRecord = await this.repositoryModuleManager.getPeerRecord(peerId, blockchainId);
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

        const mappedStake = new BigNumber(peerRecord.stake).dividedBy(stakeMappingCoefficient);
        const mappedDistance = new BigNumber(distanceUint8Array).dividedBy(
            distanceMappingCoefficient,
        );

        const dividend = mappedStake.pow(stakeExponent).multipliedBy(a).plus(b);
        const divisor = mappedDistance.pow(distanceExponent).multipliedBy(c).plus(d);

        return Math.floor(
            multiplier * Math.log2(logArgumentConstant + dividend.dividedBy(divisor)),
        );
    }
}

export default ServiceAgreementService;
