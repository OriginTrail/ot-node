import { BigNumber } from 'ethers';
import Web3 from 'web3';

import {
    // STAKE_UINT256_MULTIPLIER_BN,
    UINT256_UINT32_DIVISOR_BN,
    UINT32_MAX_BN,
} from '../constants/constants.js';

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
            Web3.utils.encodePacked(assetTypeContract, tokenId, keyword),
        );
    }

    async getServiceAgreementData(blockchain, agreementId) {
        return {
            epochsNumber: await this.blockchainModuleManager.getAgreementEpochsNumber(
                blockchain,
                agreementId,
            ),
            startTime: await this.blockchainModuleManager.getAgreementStartTime(
                blockchain,
                agreementId,
            ),
            epochLength: await this.blockchainModuleManager.getAgreementEpochLength(
                blockchain,
                agreementId,
            ),
            tokenAmount: await this.blockchainModuleManager.getAgreementTokenAmount(
                blockchain,
                agreementId,
            ),
            proofWindowOffsetPerc:
                await this.blockchainModuleManager.getAgreementProofWindowOffsetPerc(
                    blockchain,
                    agreementId,
                ),
            scoreFunctionId: await this.blockchainModuleManager.getAgreementScoreFunctionId(
                blockchain,
                agreementId,
            ),
        };
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

        // todo update parameters once defined
        // const a = 1;
        // const b = 0;
        // const stakeExponent = 1;
        // const c = 1;
        // const d = 0;
        // const distanceExponent = 1;

        // const mappedStake = BigNumber.from(peerRecord.stake).mul(STAKE_UINT256_MULTIPLIER_BN);

        // const dividend = mappedStake.pow(stakeExponent).mul(a).add(b);
        // const divisor = distanceUint256BN.pow(distanceExponent).mul(c).add(d);

        // return dividend.div(divisor).div(UINT256_UINT32_DIVISOR_BN).toNumber();
        return UINT32_MAX_BN.sub(distanceUint256BN.div(UINT256_UINT32_DIVISOR_BN)).toNumber();
    }
}

export default ServiceAgreementService;
