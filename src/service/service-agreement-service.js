import { ethers } from 'ethers';

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

        return this.blockchainModuleManager.callScoreFunction(
            blockchainId,
            1,
            hashFunctionId,
            peerRecord.peer_id,
            keyword,
            this.blockchainModuleManager.convertToWei(blockchainId, peerRecord.stake),
        );
    }
}

export default ServiceAgreementService;
